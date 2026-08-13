import type { AttachmentKind } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import type { GalleryItem, Paginated } from '@/types/dto';

/** Media on one tab, everything else on the other — how people actually look. */
const MEDIA_KINDS: AttachmentKind[] = ['IMAGE', 'VIDEO'];

const DEFAULT_PAGE_SIZE = 40;
/**
 * Capped so a caller cannot ask for the whole conversation in one request.
 * Small values are allowed on purpose: what a pagination test needs to prove is
 * that crossing a page boundary neither skips nor repeats, and that is true of
 * any boundary. Uploading 45 real images to reach a hardcoded 40 made the suite
 * take longer than ten minutes.
 */
const MAX_PAGE_SIZE = 100;

/**
 * Everything shared in a conversation, newest first.
 *
 * Search already finds files by name, but that is not how anyone looks for a
 * photo: you look for it by looking. This is the grid.
 *
 * Deleted messages are excluded — a soft-deleted message hides its attachments
 * everywhere else, and the gallery must not be the hole in that.
 */
export async function listGallery(
  conversationId: string,
  options: { tab: 'media' | 'files'; cursor?: string | null; limit?: number } = { tab: 'media' },
): Promise<Paginated<GalleryItem>> {
  const pageSize = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

  const rows = await prisma.attachment.findMany({
    where: {
      message: { conversationId, deletedAt: null },
      kind: options.tab === 'media' ? { in: MEDIA_KINDS } : { notIn: MEDIA_KINDS },
    },
    select: {
      id: true,
      kind: true,
      url: true,
      name: true,
      size: true,
      mimeType: true,
      width: true,
      height: true,
      createdAt: true,
      messageId: true,
      message: { select: { author: { select: { id: true, displayName: true } } } },
    },
    // `id` breaks ties on a non-unique timestamp, the same as the message
    // history: without it a cursor can skip or repeat rows.
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: pageSize + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;

  return {
    items: page.map((row) => ({
      id: row.id,
      kind: row.kind,
      url: row.url,
      name: row.name,
      size: row.size,
      mimeType: row.mimeType,
      width: row.width,
      height: row.height,
      createdAt: row.createdAt.toISOString(),
      messageId: row.messageId,
      author: row.message.author
        ? { id: row.message.author.id, displayName: row.message.author.displayName }
        : null,
    })),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  };
}
