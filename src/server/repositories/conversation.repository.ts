import { Prisma, type ConversationMember } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { errors } from '@/server/errors';
import {
  memberInclude,
  publicUserSelect,
  toMember,
  toPublicUser,
  type PublicUserRow,
} from '@/server/repositories/selectors';
import type { ConversationDetail, ConversationSummary } from '@/types/dto';

const summaryInclude = {
  members: { include: { user: { select: publicUserSelect } } },
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
} satisfies Prisma.ConversationInclude;

type ConversationRow = Prisma.ConversationGetPayload<{ include: typeof summaryInclude }>;

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

function resolvePeer(conversation: ConversationRow, viewerId: string): PublicUserRow | null {
  if (conversation.type !== 'DIRECT') return null;
  return conversation.members.find((member) => member.userId !== viewerId)?.user ?? null;
}

export function toSummary(
  conversation: ConversationRow,
  membership: Pick<
    ConversationMember,
    'role' | 'favorite' | 'archived' | 'muted' | 'draft' | 'lastReadAt'
  >,
  viewerId: string,
  unread: number,
): ConversationSummary {
  const peer = resolvePeer(conversation, viewerId);
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
    include: { conversation: { include: summaryInclude } },
    orderBy: { conversation: { lastMessageAt: 'desc' } },
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

/** Loads a conversation, asserting the viewer is a member of it. */
export async function requireMembership(conversationId: string, userId: string) {
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    include: { conversation: true },
  });
  if (!membership) throw errors.forbidden('You are not a member of this conversation.');
  return membership;
}

export async function getConversationDetail(
  conversationId: string,
  userId: string,
): Promise<ConversationDetail> {
  const membership = await requireMembership(conversationId, userId);

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { ...summaryInclude, joinRequests: { where: { status: 'PENDING' }, select: { id: true } } },
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

export async function getSummaryFor(
  conversationId: string,
  userId: string,
): Promise<ConversationSummary | null> {
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    include: { conversation: { include: summaryInclude } },
  });
  if (!membership) return null;

  const unread = await unreadCounts(userId, [conversationId]);
  return toSummary(membership.conversation, membership, userId, unread.get(conversationId) ?? 0);
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
