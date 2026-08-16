import { prisma } from '@/lib/prisma';
import { SEARCH_PAGE_SIZE } from '@/lib/constants';
import { messageInclude, publicUserSelect, toMessage, toPublicUser } from '@/server/repositories/selectors';
import { getSummariesFor } from '@/server/repositories/conversation.repository';
import type { SearchResults } from '@/types/dto';

export type SearchScope = 'all' | 'users' | 'conversations' | 'messages' | 'files';

const EMPTY: SearchResults = { users: [], conversations: [], messages: [], files: [] };

/**
 * Restricts a search to conversations the viewer belongs to.
 *
 * Expressed as a relation filter — Prisma compiles it to a correlated `EXISTS`
 * — rather than by loading the viewer's conversation ids and passing them as an
 * `IN` list. Both are correct; only this one has a bounded query size. Somebody
 * in five hundred groups would otherwise put five hundred UUIDs into the text
 * of every search they run.
 */
const memberOf = (viewerId: string) => ({
  conversation: { members: { some: { userId: viewerId } } },
});

/**
 * One query, four result sets. Everything is scoped to conversations the
 * viewer is actually a member of, so search can never leak private history.
 */
export async function globalSearch(
  viewerId: string,
  rawQuery: string,
  scope: SearchScope = 'all',
): Promise<SearchResults> {
  const query = rawQuery.trim();
  if (query.length < 2) return EMPTY;

  const wants = (target: SearchScope) => scope === 'all' || scope === target;

  const [users, memberships, messages, attachments] = await Promise.all([
    wants('users')
      ? prisma.user.findMany({
          where: {
            id: { not: viewerId },
            OR: [
              { username: { contains: query, mode: 'insensitive' } },
              { displayName: { contains: query, mode: 'insensitive' } },
            ],
            blocksMade: { none: { blockedId: viewerId } },
            blocksReceived: { none: { blockerId: viewerId } },
          },
          select: publicUserSelect,
          take: SEARCH_PAGE_SIZE,
          orderBy: { username: 'asc' },
        })
      : Promise.resolve([]),

    wants('conversations')
      ? prisma.conversationMember.findMany({
          where: {
            userId: viewerId,
            conversation: {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
                { members: { some: { user: { displayName: { contains: query, mode: 'insensitive' } } } } },
              ],
            },
          },
          select: { conversationId: true },
          take: SEARCH_PAGE_SIZE,
        })
      : Promise.resolve([]),

    wants('messages')
      ? prisma.message.findMany({
          where: {
            ...memberOf(viewerId),
            deletedAt: null,
            kind: 'TEXT',
            content: { contains: query, mode: 'insensitive' },
          },
          include: {
            ...messageInclude(viewerId),
            conversation: { select: { id: true, name: true, type: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: SEARCH_PAGE_SIZE,
        })
      : Promise.resolve([]),

    wants('files')
      ? prisma.attachment.findMany({
          where: {
            name: { contains: query, mode: 'insensitive' },
            message: { ...memberOf(viewerId), deletedAt: null },
          },
          include: {
            message: {
              select: {
                id: true,
                createdAt: true,
                conversationId: true,
                conversation: { select: { name: true, type: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: SEARCH_PAGE_SIZE,
        })
      : Promise.resolve([]),
  ]);

  const conversations = await getSummariesFor(
    memberships.map((membership) => membership.conversationId),
    viewerId,
  );

  return {
    users: users.map(toPublicUser),
    conversations,
    messages: messages.map((row) => ({
      message: toMessage(row, viewerId),
      conversation: {
        id: row.conversation.id,
        name: row.conversation.name ?? 'Direct message',
        type: row.conversation.type,
        avatarUrl: row.conversation.avatarUrl,
      },
    })),
    files: attachments.map((attachment) => ({
      attachment: {
        id: attachment.id,
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
      },
      messageId: attachment.message.id,
      conversationId: attachment.message.conversationId,
      conversationName: attachment.message.conversation.name ?? 'Direct message',
      createdAt: attachment.message.createdAt.toISOString(),
    })),
  };
}
