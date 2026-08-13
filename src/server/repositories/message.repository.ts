import { prisma } from '@/lib/prisma';
import { MESSAGE_PAGE_SIZE } from '@/lib/constants';
import { errors } from '@/server/errors';
import { messageInclude, toMessage } from '@/server/repositories/selectors';
import type { MessageDTO, Paginated } from '@/types/dto';

export async function getMessageOrThrow(messageId: string, viewerId: string): Promise<MessageDTO> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: messageInclude(viewerId),
  });
  if (!message) throw errors.notFound('Message not found.');
  return toMessage(message, viewerId);
}

/**
 * Newest-first page of a conversation. `cursor` is the id of the oldest message
 * already loaded, so paging walks backwards through history.
 */
export async function listMessages(
  conversationId: string,
  viewerId: string,
  options: { cursor?: string | null; limit?: number } = {},
): Promise<Paginated<MessageDTO>> {
  const limit = Math.min(options.limit ?? MESSAGE_PAGE_SIZE, 100);

  const rows = await prisma.message.findMany({
    where: { conversationId },
    include: messageInclude(viewerId),
    // `id` breaks ties: `createdAt` is not unique, and a cursor into a
    // non-total ordering can skip or repeat rows when two messages land in the
    // same millisecond — easy to hit with a burst of sends.
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    // Reversed so the caller renders oldest → newest.
    items: page.map((row) => toMessage(row, viewerId)).reverse(),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  };
}

/**
 * One branch of the conversation: a message and everything replying to it.
 *
 * Replies stay visible in the main view as well. Hiding them there is the Slack
 * model and it suits a busy workspace, but this is a chat where a single reply
 * is ordinary — burying it behind a counter would make people miss messages.
 * The panel is for focusing a branch, not for hiding it.
 *
 * One level deep on purpose: replies to replies are rare in practice and a tree
 * costs a recursive query plus a UI nobody asked for.
 */
export async function listThread(
  rootId: string,
  viewerId: string,
): Promise<{ root: MessageDTO; replies: MessageDTO[] } | null> {
  const root = await prisma.message.findUnique({
    where: { id: rootId },
    include: messageInclude(viewerId),
  });
  if (!root) return null;

  const replies = await prisma.message.findMany({
    where: { replyToId: rootId },
    include: messageInclude(viewerId),
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 200,
  });

  return {
    root: toMessage(root, viewerId),
    replies: replies.map((row) => toMessage(row, viewerId)),
  };
}

export async function listPinnedMessages(
  conversationId: string,
  viewerId: string,
): Promise<MessageDTO[]> {
  const rows = await prisma.message.findMany({
    where: { conversationId, pinnedAt: { not: null }, deletedAt: null },
    include: messageInclude(viewerId),
    orderBy: { pinnedAt: 'desc' },
    take: 50,
  });
  return rows.map((row) => toMessage(row, viewerId));
}

export async function listStarredMessages(viewerId: string): Promise<MessageDTO[]> {
  const rows = await prisma.message.findMany({
    where: { stars: { some: { userId: viewerId } }, deletedAt: null },
    include: messageInclude(viewerId),
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map((row) => toMessage(row, viewerId));
}

/** Conversation ids the viewer can read — the scope for every search query. */
export async function visibleConversationIds(viewerId: string): Promise<string[]> {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId: viewerId },
    select: { conversationId: true },
  });
  return memberships.map((membership) => membership.conversationId);
}
