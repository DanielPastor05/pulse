import { after } from 'next/server';
import { Prisma, type User } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { realtimeEvents } from '@/lib/realtime';
import { truncate } from '@/lib/utils';
import { broadcastToConversation, broadcastToUsers } from '@/server/broadcast';
import { errors } from '@/server/errors';
import {
  conversationMemberIds,
  requireMembership,
} from '@/server/repositories/conversation.repository';
import { fetchLinkPreview, firstUrl } from '@/server/link-preview';
import { getMessageOrThrow } from '@/server/repositories/message.repository';
import {
  freshMessageInclude,
  messageInclude,
  toFreshMessage,
  toMessage,
} from '@/server/repositories/selectors';
import { can } from '@/lib/permissions';
import { recordModeration } from '@/server/services/audit.service';
import { embedMessage } from '@/server/services/embedding.service';
import { notify } from '@/server/services/notification.service';
import type { SendMessageInput } from '@/features/messages/validators';
import type { MessageDTO } from '@/types/dto';
import { describeError, log } from '@/server/logger';

const MENTION_PATTERN = /(?:^|[^\w])@([a-z0-9_]{3,24})/g;

function extractMentions(content: string): string[] {
  const found = new Set<string>();
  for (const match of content.matchAll(MENTION_PATTERN)) {
    if (match[1]) found.add(match[1]);
  }
  return [...found];
}

function previewOf(message: { content: string; attachmentCount: number }): string {
  if (message.content.trim()) return truncate(message.content.trim(), 120);
  return message.attachmentCount === 1 ? 'Sent an attachment' : 'Sent attachments';
}

/** Blocks make a direct conversation write-only-to-nobody in both directions. */
async function assertNotBlocked(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { type: true, members: { select: { userId: true } } },
  });
  if (conversation?.type !== 'DIRECT') return;

  const peerId = conversation.members.find((member) => member.userId !== userId)?.userId;
  if (!peerId) return;

  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: peerId },
        { blockerId: peerId, blockedId: userId },
      ],
    },
    select: { blockerId: true },
  });
  if (block) throw errors.blocked('This conversation is blocked.');
}

export async function sendMessage(
  conversationId: string,
  author: User,
  input: SendMessageInput,
): Promise<MessageDTO> {
  await requireMembership(conversationId, author.id);
  await assertNotBlocked(conversationId, author.id);

  if (input.replyToId) {
    const parent = await prisma.message.findFirst({
      where: { id: input.replyToId, conversationId },
      select: { id: true },
    });
    if (!parent) throw errors.badRequest('You can only reply to messages in this conversation.');
  }

  // A forwarded reference embeds the source message's content and author into
  // the new message's DTO. Without this check any authenticated user could
  // dereference an arbitrary message id and read a conversation they are not a
  // member of. The forward flow already verifies membership before calling in,
  // so this guard is redundant there and load-bearing for direct API calls.
  if (input.forwardedFromId) {
    const source = await prisma.message.findUnique({
      where: { id: input.forwardedFromId },
      select: { conversationId: true },
    });
    if (!source) throw errors.notFound('That message no longer exists.');
    await requireMembership(source.conversationId, author.id);
  }

  const content = input.content.trim();

  // Retrying a send whose response never came back must not post twice. The
  // fast path catches the common case; the unique constraint catches two
  // attempts racing, which the lookup alone cannot.
  if (input.clientId) {
    const already = await prisma.message.findUnique({
      where: { authorId_clientId: { authorId: author.id, clientId: input.clientId } },
      select: { id: true },
    });
    if (already) return getMessageOrThrow(already.id, author.id);
  }

  const write = () =>
    prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          clientId: input.clientId ?? null,
        conversationId,
        authorId: author.id,
        content,
        replyToId: input.replyToId ?? null,
        forwardedFromId: input.forwardedFromId ?? null,
        attachments: input.attachments.length
          ? {
              createMany: {
                data: input.attachments.map((attachment) => ({
                  kind: attachment.kind,
                  url: attachment.url,
                  path: attachment.path,
                  name: attachment.name,
                  size: attachment.size,
                  mimeType: attachment.mimeType,
                  width: attachment.width ?? null,
                  height: attachment.height ?? null,
                  duration: attachment.duration ?? null,
                  waveform: attachment.waveform ?? [],
                })),
              },
            }
          : undefined,
        },
        include: freshMessageInclude,
      });

      // `lastMessageAt` se actualiza después de esta transacción, no dentro.
      //
      // Es una pista de ordenación denormalizada, no un dato que deba ser
      // atómico con el mensaje: si se retrasa unos milisegundos, la lista se
      // ordena un instante por el mensaje anterior y el siguiente envío lo
      // corrige. Sacarla acorta la transacción y deja de mantener abierto un
      // bloqueo exclusivo sobre una fila que todos los miembros comparten.
      //
      // Aviso para quien mida: sacarla **no** fue lo que arregló la latencia
      // bajo concurrencia. Se probó, y el p50 con diez emisores no se movió.
      // Lo que sí la movió está más abajo, en el número de viajes a la base de
      // datos que hace un envío.

      await tx.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: author.id } },
        data: { lastReadAt: message.createdAt, lastReadMessageId: message.id, draft: null },
      });

      return message;
    });

  let created: Awaited<ReturnType<typeof write>>;
  try {
    created = await write();
  } catch (error) {
    // Two attempts raced past the lookup above and the constraint caught the
    // loser. That is the retry doing its job, not a failure: hand back the row
    // the winner wrote, and skip the side effects it already performed.
    if (
      input.clientId &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const winner = await prisma.message.findUnique({
        where: { authorId_clientId: { authorId: author.id, clientId: input.clientId } },
        select: { id: true },
      });
      if (winner) return getMessageOrThrow(winner.id, author.id);
    }
    throw error;
  }

  const dto = toFreshMessage(created);
  const memberIds = await conversationMemberIds(conversationId);

  // Mentions are resolved against members only — no pinging outsiders.
  const usernames = extractMentions(content);
  let mentionedIds: string[] = [];
  if (usernames.length > 0) {
    const mentioned = await prisma.user.findMany({
      where: { username: { in: usernames }, id: { in: memberIds } },
      select: { id: true },
    });
    mentionedIds = mentioned.map((user) => user.id).filter((id) => id !== author.id);
    if (mentionedIds.length > 0) {
      await prisma.mention.createMany({
        data: mentionedIds.map((userId) => ({ messageId: created.id, userId })),
        skipDuplicates: true,
      });
    }
  }

  const preview = previewOf({ content, attachmentCount: input.attachments.length });

  /**
   * El reparto no bloquea la respuesta.
   *
   * Avisar a los demás cuesta un mensaje de realtime por destinatario, más los
   * de notificación: en un grupo de once eran más de veinte por cada envío.
   * Esperarlos convertía el tamaño del grupo en latencia de quien escribe, y se
   * midió: diez emisores simultáneos en la misma sala tardaban 13,4 s en recibir
   * el 201, mientras el mensaje ya había llegado al destinatario a los 1,8 s.
   * Es decir, la petición pasaba once segundos esperando trabajo que al emisor
   * no le sirve de nada.
   *
   * El mensaje está a salvo en la base de datos antes de llegar aquí, así que
   * lo único que se pospone es a quién se le cuenta. Si el reparto falla, el
   * registro lo dice y el cliente se recupera al reenfocar la pestaña — que es
   * exactamente la garantía que ya teníamos, ahora sin pagarla en latencia.
   */
  after(async () => {
    // La marca de última actividad, antes de avisar a nadie.
    //
    // Estaba en el camino de la respuesta y resultó ser **el mayor consumidor
    // de tiempo de base de datos de toda la aplicación**: 57% del total, con
    // 433 ms de media. Todos los envíos a una misma conversación escriben la
    // misma fila, así que bajo concurrencia se serializan en su bloqueo — el
    // tamaño de la sala volvía a cobrarse a quien escribe, igual que hacía el
    // reparto antes de moverse aquí.
    //
    // Lo curioso es que esta hipótesis se probó al principio del proyecto y se
    // descartó: sacarla de la transacción no movía el p50. No estaba
    // equivocada, estaba **tapada** — con el reparto costando trece segundos,
    // medio segundo no se veía. Al quitar lo grande, quedó a la vista.
    //
    // Va antes de los avisos a propósito: quien reciba `inbox.updated` va a
    // pedir la lista de conversaciones, y si la marca aún no está escrita la
    // recibiría en el orden viejo.
    //
    // Guarda de monotonía: si dos envíos terminan desordenados, el más viejo no
    // puede hacer retroceder la marca. `updateMany` y no `update` porque la
    // condición va en el `where`, así que la fila ni se toca cuando ya está por
    // delante — que es también lo que evita tomar el bloqueo sin necesidad.
    await prisma.conversation.updateMany({
      where: { id: conversationId, lastMessageAt: { lt: created.createdAt } },
      data: { lastMessageAt: created.createdAt },
    });

    await Promise.all([
      broadcastToConversation(conversationId, realtimeEvents.messageCreated, {
        message: dto,
        clientId: input.clientId ?? null,
      }),
      broadcastToUsers(memberIds, realtimeEvents.inboxUpdated, { conversationId }),
      notify({
        userIds: mentionedIds,
        kind: 'MENTION',
        title: `${author.displayName} mentioned you`,
        body: preview,
        actorId: author.id,
        conversationId,
        messageId: created.id,
      }),
      notify({
        userIds: memberIds.filter((id) => !mentionedIds.includes(id)),
        kind: 'MESSAGE',
        title: author.displayName,
        body: preview,
        actorId: author.id,
        conversationId,
        messageId: created.id,
      }),
    ]);
  });

  // Deliberately after the response: resolving a link means waiting on somebody
  // else's server, and no chat message should be held up by a slow website.
  // The card arrives moments later over the same channel that carries edits.
  after(() => attachLinkPreview(created.id, conversationId, content, author.id));

  // También fuera de la respuesta, y por el mismo motivo: embeber cuesta unos
  // cientos de milisegundos y nadie debería esperarlos para ver su propio
  // mensaje enviado. Si falla, el mensaje se queda sin vector y lo recoge la
  // tarea programada — no hay estado inconsistente, sólo un mensaje que durante
  // unas horas sólo encuentra la búsqueda léxica.
  after(() => embedMessage(created.id, content));

  return dto;
}

/**
 * Resolves the first link in a message and attaches the card.
 *
 * Never throws: this runs detached from the request, so an unreachable or
 * hostile URL has to end quietly rather than surface anywhere.
 */
async function attachLinkPreview(
  messageId: string,
  conversationId: string,
  content: string,
  authorId: string,
) {
  try {
    const url = firstUrl(content);
    if (!url) return;

    let preview = await prisma.linkPreview.findUnique({ where: { url } });

    if (!preview) {
      const data = await fetchLinkPreview(url);
      // Failures are stored too, so a dead host is not re-fetched every time
      // somebody shares the same link.
      preview = await prisma.linkPreview.upsert({
        where: { url },
        create: { url, failed: data === null, ...(data ?? {}) },
        update: {},
      });
    }

    if (preview.failed) return;

    await prisma.message.update({
      where: { id: messageId },
      data: { linkPreviewId: preview.id },
    });

    // Rendered from the author's view, like every other `messageUpdated`
    // broadcast here — receivers keep their own `starred` and `reactions`.
    const updated = await getMessageOrThrow(messageId, authorId);
    await broadcastToConversation(conversationId, realtimeEvents.messageUpdated, {
      message: updated,
    });
  } catch (error) {
    log.error('link_preview.attach_failed', describeError(error));
  }
}

export async function editMessage(
  messageId: string,
  user: User,
  content: string,
): Promise<MessageDTO> {
  const existing = await prisma.message.findUnique({
    where: { id: messageId },
    select: { authorId: true, conversationId: true, deletedAt: true },
  });
  if (!existing) throw errors.notFound('Message not found.');
  if (existing.deletedAt) throw errors.badRequest('That message was deleted.');
  if (existing.authorId !== user.id) throw errors.forbidden('You can only edit your own messages.');

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { content: content.trim(), editedAt: new Date() },
    include: messageInclude(user.id),
  });

  const dto = toMessage(updated, user.id);
  await broadcastToConversation(existing.conversationId, realtimeEvents.messageUpdated, {
    message: dto,
  });
  return dto;
}

export async function deleteMessage(messageId: string, user: User): Promise<void> {
  const existing = await prisma.message.findUnique({
    where: { id: messageId },
    select: { authorId: true, conversationId: true },
  });
  if (!existing) throw errors.notFound('Message not found.');

  const membership = await requireMembership(existing.conversationId, user.id);
  const isAuthor = existing.authorId === user.id;
  if (!isAuthor && !can.moderateMessages(membership.role)) {
    throw errors.forbidden('You cannot delete this message.');
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { content: '', deletedAt: new Date(), pinnedAt: null, pinnedById: null },
  });
  await prisma.attachment.deleteMany({ where: { messageId } });

  // Solo cuando lo borra otra persona. Borrar lo tuyo no es moderar, y
  // registrarlo convertiria el historial en un diario de todo el mundo.
  if (!isAuthor) {
    const author = existing.authorId
      ? await prisma.user.findUnique({
          where: { id: existing.authorId },
          select: { id: true, displayName: true },
        })
      : null;
    await recordModeration({
      conversationId: existing.conversationId,
      actor: user,
      action: 'MESSAGE_DELETED',
      target: author,
      detail: messageId,
    });
  }

  await broadcastToConversation(existing.conversationId, realtimeEvents.messageDeleted, {
    messageId,
    conversationId: existing.conversationId,
  });
}

export async function toggleReaction(
  messageId: string,
  user: User,
  emoji: string,
): Promise<MessageDTO> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { conversationId: true, authorId: true, deletedAt: true },
  });
  if (!message || message.deletedAt) throw errors.notFound('Message not found.');
  await requireMembership(message.conversationId, user.id);

  const existing = await prisma.reaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId: user.id, emoji } },
    select: { id: true },
  });

  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.reaction.create({ data: { messageId, userId: user.id, emoji } });
    if (message.authorId && message.authorId !== user.id) {
      await notify({
        userIds: [message.authorId],
        kind: 'REACTION',
        title: `${user.displayName} reacted ${emoji}`,
        actorId: user.id,
        conversationId: message.conversationId,
        messageId,
      });
    }
  }

  const dto = await getMessageOrThrow(messageId, user.id);

  // `reactedByMe` is viewer-specific, so the wire format stays raw and each
  // client derives its own flag.
  const rows = await prisma.reaction.findMany({
    where: { messageId },
    select: { emoji: true, userId: true },
  });
  await broadcastToConversation(message.conversationId, realtimeEvents.reactionChanged, {
    messageId,
    conversationId: message.conversationId,
    reactions: rows,
  });

  return dto;
}

export async function setPinned(
  messageId: string,
  user: User,
  pinned: boolean,
): Promise<MessageDTO> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { conversationId: true },
  });
  if (!message) throw errors.notFound('Message not found.');

  const membership = await requireMembership(message.conversationId, user.id);
  const isDirect = membership.conversation.type === 'DIRECT';
  if (!isDirect && !can.pinMessages(membership.role)) {
    throw errors.forbidden('Only moderators can pin messages here.');
  }

  await prisma.message.update({
    where: { id: messageId },
    data: pinned
      ? { pinnedAt: new Date(), pinnedById: user.id }
      : { pinnedAt: null, pinnedById: null },
  });

  const dto = await getMessageOrThrow(messageId, user.id);
  await broadcastToConversation(message.conversationId, realtimeEvents.messageUpdated, {
    message: dto,
  });
  return dto;
}

export async function setStarred(
  messageId: string,
  user: User,
  starred: boolean,
): Promise<MessageDTO> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { conversationId: true },
  });
  if (!message) throw errors.notFound('Message not found.');
  await requireMembership(message.conversationId, user.id);

  if (starred) {
    await prisma.starredMessage.upsert({
      where: { messageId_userId: { messageId, userId: user.id } },
      create: { messageId, userId: user.id },
      update: {},
    });
  } else {
    await prisma.starredMessage
      .delete({ where: { messageId_userId: { messageId, userId: user.id } } })
      .catch(() => undefined);
  }

  return getMessageOrThrow(messageId, user.id);
}

export async function forwardMessage(
  messageId: string,
  user: User,
  conversationIds: string[],
): Promise<number> {
  const source = await prisma.message.findUnique({
    where: { id: messageId },
    include: { attachments: true },
  });
  if (!source || source.deletedAt) throw errors.notFound('Message not found.');
  await requireMembership(source.conversationId, user.id);

  let delivered = 0;
  for (const conversationId of conversationIds) {
    await sendMessage(conversationId, user, {
      content: source.content,
      forwardedFromId: source.id,
      replyToId: null,
      attachments: source.attachments.map((attachment) => ({
        kind: attachment.kind,
        url: attachment.url,
        path: attachment.path,
        name: attachment.name,
        size: attachment.size,
        mimeType: attachment.mimeType,
        width: attachment.width,
        height: attachment.height,
        duration: attachment.duration,
        waveform: attachment.waveform,
      })),
    });
    delivered += 1;
  }
  return delivered;
}

export async function markConversationRead(
  conversationId: string,
  user: User,
  messageId: string,
): Promise<void> {
  await requireMembership(conversationId, user.id);

  const message = await prisma.message.findFirst({
    where: { id: messageId, conversationId },
    select: { createdAt: true },
  });
  if (!message) throw errors.notFound('Message not found.');

  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: user.id } },
    data: { lastReadAt: message.createdAt, lastReadMessageId: messageId },
  });

  await prisma.notification.updateMany({
    where: { userId: user.id, conversationId, readAt: null },
    data: { readAt: new Date() },
  });

  await broadcastToConversation(conversationId, realtimeEvents.readReceipt, {
    conversationId,
    userId: user.id,
    lastReadMessageId: messageId,
    readAt: message.createdAt.toISOString(),
  });
}
