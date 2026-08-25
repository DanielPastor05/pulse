import { cache } from 'react';
import { Prisma, type ConversationMember } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { errors } from '@/server/errors';
import { memoDePeticion } from '@/server/request-scope';
import {
  memberInclude,
  publicUserSelect,
  toMember,
  toPublicUser,
  type PublicUserRow,
} from '@/server/repositories/selectors';
import type { ConversationDetail, ConversationSummary } from '@/types/dto';

/**
 * Everything a conversation summary needs, and nothing else.
 *
 * `members` is deliberately one row, not all of them. The only thing a summary
 * does with members is resolve the other person in a direct chat — the member
 * count comes from `_count`. Including the whole list meant that rendering the
 * sidebar for somebody in a five-hundred-person group loaded five hundred user
 * rows to display one name.
 *
 * Hence the parameter: the row we want is the first member who is not the
 * viewer, which cannot be expressed without knowing who is looking.
 */
const summaryInclude = (viewerId: string) =>
  ({
    members: {
      where: { userId: { not: viewerId } },
      take: 1,
      include: { user: { select: publicUserSelect } },
    },
    _count: { select: { members: true } },
    messages: {
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' as const },
      take: 1,
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: { displayName: true } },
        _count: { select: { attachments: true } },
      },
    },
  }) satisfies Prisma.ConversationInclude;

type ConversationRow = Prisma.ConversationGetPayload<{
  include: ReturnType<typeof summaryInclude>;
}>;

/** Unread counts for many conversations in one round trip. */
async function unreadCounts(userId: string, conversationIds: string[]) {
  if (conversationIds.length === 0) return new Map<string, number>();

  const rows = await prisma.$queryRaw<Array<{ conversationId: string; count: bigint }>>(Prisma.sql`
    SELECT m."conversationId" AS "conversationId", COUNT(*) AS count
    FROM "messages" m
    JOIN "conversation_members" cm
      ON cm."conversationId" = m."conversationId" AND cm."userId" = ${userId}::uuid
    WHERE m."conversationId" IN (${Prisma.join(
      conversationIds.map((id) => Prisma.sql`${id}::uuid`),
    )})
      AND m."deletedAt" IS NULL
      AND (m."authorId" IS NULL OR m."authorId" <> ${userId}::uuid)
      AND (cm."lastReadAt" IS NULL OR m."createdAt" > cm."lastReadAt")
    GROUP BY m."conversationId"
  `);

  return new Map(rows.map((row) => [row.conversationId, Number(row.count)]));
}

/** `members` is already filtered to the one row that is not the viewer. */
function resolvePeer(conversation: ConversationRow): PublicUserRow | null {
  if (conversation.type !== 'DIRECT') return null;
  return conversation.members[0]?.user ?? null;
}

export function toSummary(
  conversation: ConversationRow,
  membership: Pick<
    ConversationMember,
    'role' | 'favorite' | 'archived' | 'muted' | 'draft' | 'background' | 'lastReadAt'
  >,
  viewerId: string,
  unread: number,
): ConversationSummary {
  const peer = resolvePeer(conversation);
  const lastMessage = conversation.messages[0] ?? null;

  return {
    id: conversation.id,
    type: conversation.type,
    name: conversation.name ?? peer?.displayName ?? 'Direct message',
    slug: conversation.slug,
    description: conversation.description,
    avatarUrl: conversation.avatarUrl ?? peer?.avatarUrl ?? null,
    accent: conversation.accent,
    isPublic: conversation.isPublic,
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    unreadCount: unread,
    memberCount: conversation._count.members,
    favorite: membership.favorite,
    archived: membership.archived,
    muted: membership.muted,
    draft: membership.draft,
    background: membership.background,
    role: membership.role,
    peer: peer ? toPublicUser(peer) : null,
    lastMessage: lastMessage
      ? {
          id: lastMessage.id,
          content: lastMessage.content,
          authorName: lastMessage.author?.displayName ?? null,
          createdAt: lastMessage.createdAt.toISOString(),
          hasAttachments: lastMessage._count.attachments > 0,
        }
      : null,
  };
}

export async function listConversations(
  userId: string,
  filter: { archived?: boolean } = {},
): Promise<ConversationSummary[]> {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId, archived: filter.archived ?? false },
    include: { conversation: { include: summaryInclude(userId) } },
    // No cursor here, so nothing can be dropped — but `lastMessageAt` is null
    // for conversations nobody has written in yet, and ties would come back in
    // arbitrary order, making the list reshuffle between renders.
    orderBy: [{ conversation: { lastMessageAt: 'desc' } }, { conversationId: 'desc' }],
  });

  const unread = await unreadCounts(
    userId,
    memberships.map((membership) => membership.conversationId),
  );

  return memberships
    .map((membership) =>
      toSummary(
        membership.conversation,
        membership,
        userId,
        unread.get(membership.conversationId) ?? 0,
      ),
    )
    .sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return b.lastMessageAt.localeCompare(a.lastMessageAt);
    });
}

/**
 * Carga la conversación afirmando que quien mira es miembro.
 *
 * Memoizada por petición, con **dos mecanismos y no uno**, porque ninguno cubre
 * los dos sitios desde los que se llama:
 *
 * - `cache()` de React sólo tiene alcance mientras se renderiza, así que cubre
 *   los componentes de servidor.
 * - `memoDePeticion` cubre los route handlers, donde `cache()` no memoiza nada.
 *   Está medido: con `cache()` a solas, dos llamadas seguidas dentro de un
 *   manejador ejecutaban la consulta **dos veces**.
 *
 * Importa por dos cosas. La primera es que varias rutas ya comprobaban la
 * pertenencia y llamaban después a un servicio que la vuelve a comprobar: eso
 * eran dos consultas idénticas por petición, pagadas desde siempre. La segunda
 * es que permite comprobar la pertenencia **antes** de validar el cuerpo sin
 * coste, que es lo que evita responder con la forma del esquema a quien no
 * tiene acceso al endpoint.
 *
 * Se memoiza también el rechazo, que es lo que se quiere: si no es miembro, no
 * lo será dos líneas más abajo.
 */
export const requireMembership = cache((conversationId: string, userId: string) =>
  memoDePeticion(`membership:${conversationId}:${userId}`, async () => {
    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      include: { conversation: true },
    });
    if (!membership) throw errors.forbidden('You are not a member of this conversation.');
    return membership;
  }),
);

export async function getConversationDetail(
  conversationId: string,
  userId: string,
): Promise<ConversationDetail> {
  const membership = await requireMembership(conversationId, userId);

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { ...summaryInclude(userId), joinRequests: { where: { status: 'PENDING' }, select: { id: true } } },
  });
  if (!conversation) throw errors.notFound('Conversation not found.');

  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    include: memberInclude,
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  });

  const unread = await unreadCounts(userId, [conversationId]);
  const summary = toSummary(conversation, membership, userId, unread.get(conversationId) ?? 0);

  const peerId = summary.peer?.id;
  const [blockedByMe, blockedMe] = peerId
    ? await Promise.all([
        prisma.block.findUnique({
          where: { blockerId_blockedId: { blockerId: userId, blockedId: peerId } },
        }),
        prisma.block.findUnique({
          where: { blockerId_blockedId: { blockerId: peerId, blockedId: userId } },
        }),
      ])
    : [null, null];

  return {
    ...summary,
    requiresApproval: conversation.requiresApproval,
    ownerId: conversation.ownerId,
    members: members.map(toMember),
    pendingJoinRequests: conversation.joinRequests.length,
    blockedByMe: Boolean(blockedByMe),
    blockedMe: Boolean(blockedMe),
  };
}

/**
 * Summaries for many conversations in two queries, whatever the count.
 *
 * Exists because calling `getSummaryFor` in a loop is two round trips per
 * conversation, and search does exactly that over a whole page of results — a
 * measured 6.0 s p50 for twenty conversations against the pooler, since the
 * trips are sequential rather than the queries being slow.
 *
 * Ids the viewer is not a member of are dropped rather than returned as null:
 * every caller wants a list it can render, and membership is the filter.
 */
export async function getSummariesFor(
  conversationIds: string[],
  userId: string,
): Promise<ConversationSummary[]> {
  if (conversationIds.length === 0) return [];

  const memberships = await prisma.conversationMember.findMany({
    where: { userId, conversationId: { in: conversationIds } },
    include: { conversation: { include: summaryInclude(userId) } },
  });

  const unread = await unreadCounts(
    userId,
    memberships.map((membership) => membership.conversationId),
  );

  const byId = new Map(
    memberships.map((membership) => [
      membership.conversationId,
      toSummary(
        membership.conversation,
        membership,
        userId,
        unread.get(membership.conversationId) ?? 0,
      ),
    ]),
  );

  // Caller order is preserved: search returns results ranked by its own query
  // and re-sorting here would silently discard that ranking.
  return conversationIds
    .map((id) => byId.get(id))
    .filter((summary): summary is ConversationSummary => summary !== undefined);
}

export async function getSummaryFor(
  conversationId: string,
  userId: string,
): Promise<ConversationSummary | null> {
  const [summary] = await getSummariesFor([conversationId], userId);
  return summary ?? null;
}

/** Finds (or creates) the 1:1 conversation between two people. */
export async function findOrCreateDirectConversation(userId: string, peerId: string) {
  if (userId === peerId) throw errors.badRequest('You cannot message yourself.');

  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: peerId },
        { blockerId: peerId, blockedId: userId },
      ],
    },
  });
  if (blocked) throw errors.blocked('You cannot message this person.');

  const existing = await prisma.conversation.findFirst({
    where: {
      type: 'DIRECT',
      AND: [{ members: { some: { userId } } }, { members: { some: { userId: peerId } } }],
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.conversation.create({
    data: {
      type: 'DIRECT',
      members: { createMany: { data: [{ userId }, { userId: peerId }] } },
    },
    select: { id: true },
  });
  return created.id;
}

export async function conversationMemberIds(conversationId: string): Promise<string[]> {
  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  return members.map((member) => member.userId);
}
