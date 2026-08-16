import { Prisma, type User } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { realtimeEvents } from '@/lib/realtime';
import { broadcastToConversation } from '@/server/broadcast';
import { errors } from '@/server/errors';
import { requireMembership } from '@/server/repositories/conversation.repository';
import { getMessageOrThrow } from '@/server/repositories/message.repository';
import type { MessageDTO } from '@/types/dto';

/**
 * Creates a poll as a message.
 *
 * The message and the poll go in together: a `POLL` message with no poll
 * attached would render as an empty bubble, and there is no sensible way to
 * recover from it afterwards.
 */
export async function createPoll(
  conversationId: string,
  author: User,
  input: { question: string; options: string[]; multiple: boolean },
): Promise<MessageDTO> {
  await requireMembership(conversationId, author.id);

  const labels = input.options.map((option) => option.trim()).filter(Boolean);
  if (labels.length < 2) throw errors.badRequest('A poll needs at least two options.');
  if (new Set(labels).size !== labels.length) {
    throw errors.badRequest('Two options say the same thing.');
  }

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId,
        authorId: author.id,
        kind: 'POLL',
        // The question doubles as the message body so search, notification
        // previews and the conversation list all keep working unchanged.
        content: input.question,
      },
      select: { id: true },
    });

    await tx.poll.create({
      data: {
        messageId: created.id,
        question: input.question,
        multiple: input.multiple,
        options: {
          createMany: {
            data: labels.map((label, position) => ({ label, position })),
          },
        },
      },
    });

    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    return created;
  });

  const dto = await getMessageOrThrow(message.id, author.id);
  await broadcastToConversation(conversationId, realtimeEvents.messageCreated, {
    message: dto,
    clientId: null,
  });

  return dto;
}

/**
 * Emite o retira un voto.
 *
 * «Un voto por encuesta» lo garantiza una restricción, no este código.
 *
 * Antes se hacía sólo aquí, con el argumento de que la tabla de votos sólo
 * conoce opciones y no encuestas. Era cierto y aun así insuficiente: leer y
 * después escribir dentro de una transacción no impide nada en `read
 * committed`, porque dos toques simultáneos en opciones distintas leen ambos el
 * mismo estado, ambos borran y ambos insertan. El resultado eran dos respuestas
 * a una pregunta de respuesta única, sin ningún error a la vista.
 *
 * La tabla sí puede conocer la encuesta: `singleChoicePollId` la guarda cuando
 * —y sólo cuando— admite una respuesta, y el índice único sobre
 * `(userId, singleChoicePollId)` hace el resto. Es el mismo movimiento que
 * arregló el envío duplicado de mensajes: la invariante baja a donde no se
 * puede saltar.
 */
export async function votePoll(
  messageId: string,
  user: User,
  optionId: string,
): Promise<MessageDTO> {
  const poll = await prisma.poll.findUnique({
    where: { messageId },
    select: {
      id: true,
      multiple: true,
      closedAt: true,
      message: { select: { conversationId: true } },
      options: { select: { id: true } },
    },
  });
  if (!poll) throw errors.notFound('That poll no longer exists.');

  await requireMembership(poll.message.conversationId, user.id);
  if (poll.closedAt) throw errors.badRequest('This poll is closed.');
  if (!poll.options.some((option) => option.id === optionId)) {
    throw errors.badRequest('That option is not part of this poll.');
  }

  const write = () =>
    prisma.$transaction(async (tx) => {
      const existing = await tx.pollVote.findUnique({
        where: { optionId_userId: { optionId, userId: user.id } },
        select: { id: true },
      });

      // Tapping your own answer again takes it back, which is what people expect
      // and the only way to undo a vote.
      if (existing) {
        await tx.pollVote.delete({ where: { id: existing.id } });
        return;
      }

      if (!poll.multiple) {
        await tx.pollVote.deleteMany({
          where: { userId: user.id, option: { pollId: poll.id } },
        });
      }

      await tx.pollVote.create({
        data: {
          optionId,
          userId: user.id,
          // Sólo se rellena en las de respuesta única: es lo que activa la
          // restricción `(userId, singleChoicePollId)`. En las múltiples queda
          // null, y Postgres no considera iguales dos null.
          singleChoicePollId: poll.multiple ? null : poll.id,
        },
      });
    });

  try {
    await write();
  } catch (error) {
    // Dos toques a la vez en opciones distintas. La restricción hizo justo su
    // trabajo — impedir el segundo voto — y quien perdió la carrera es el toque
    // más reciente, que es el que la persona quiere que valga.
    //
    // Reintentar una vez basta: al repetir, el voto del ganador ya existe, el
    // `deleteMany` se lo lleva y esta vez el insert entra. No hay bucle porque
    // sólo dos escrituras compiten, y la segunda ya no encuentra conflicto.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      await write();
    } else {
      throw error;
    }
  }

  const dto = await getMessageOrThrow(messageId, user.id);
  await broadcastToConversation(poll.message.conversationId, realtimeEvents.messageUpdated, {
    message: dto,
  });
  return dto;
}

/** Closing keeps the results and stops new votes. Author or moderator only. */
export async function closePoll(messageId: string, user: User): Promise<MessageDTO> {
  const poll = await prisma.poll.findUnique({
    where: { messageId },
    select: {
      id: true,
      closedAt: true,
      message: { select: { conversationId: true, authorId: true } },
    },
  });
  if (!poll) throw errors.notFound('That poll no longer exists.');

  const membership = await requireMembership(poll.message.conversationId, user.id);
  const isAuthor = poll.message.authorId === user.id;
  if (!isAuthor && !['OWNER', 'ADMIN', 'MODERATOR'].includes(membership.role)) {
    throw errors.forbidden('Only whoever started the poll can close it.');
  }

  if (!poll.closedAt) {
    await prisma.poll.update({ where: { id: poll.id }, data: { closedAt: new Date() } });
  }

  const dto = await getMessageOrThrow(messageId, user.id);
  await broadcastToConversation(poll.message.conversationId, realtimeEvents.messageUpdated, {
    message: dto,
  });
  return dto;
}
