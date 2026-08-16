import { Prisma } from '@prisma/client';

import type {
  AttachmentDTO,
  MemberDTO,
  MessageDTO,
  MessageReference,
  NotificationDTO,
  PublicUser,
  ReactionGroup,
} from '@/types/dto';

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bannerColor: true,
  bio: true,
  statusText: true,
  presence: true,
  lastSeenAt: true,
} satisfies Prisma.UserSelect;

export type PublicUserRow = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

/**
 * Two missed heartbeats. The client writes one every 60 s, so a gap this long
 * means the tab is gone rather than a request being slow.
 */
const PRESENCE_STALE_AFTER_MS = 2.5 * 60_000;

/**
 * Presence as it should be read, not as it was last written.
 *
 * Nothing marks somebody OFFLINE when their browser dies: sign-out writes it,
 * and a crash, a closed lid or a lost connection write nothing at all. The
 * stored value therefore stays ONLINE forever, and anyone loading the page
 * afterwards sees a green dot for somebody who left hours ago. People already
 * connected see them go through the realtime channel's `leave` event, which is
 * why this only ever looked broken to whoever arrived late.
 *
 * Deriving it here rather than sweeping the table on a schedule: the timestamp
 * needed to answer the question is already in the row, and a background job
 * that has to run to keep data honest is a job that can stop running.
 */
function livePresence(row: Pick<PublicUserRow, 'presence' | 'lastSeenAt'>): PublicUser['presence'] {
  if (row.presence === 'OFFLINE') return 'OFFLINE';
  const silentFor = Date.now() - row.lastSeenAt.getTime();
  return silentFor > PRESENCE_STALE_AFTER_MS ? 'OFFLINE' : row.presence;
}

export function toPublicUser(row: PublicUserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    bannerColor: row.bannerColor,
    bio: row.bio,
    statusText: row.statusText,
    presence: livePresence(row),
    lastSeenAt: row.lastSeenAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const messageReferenceSelect = {
  id: true,
  content: true,
  deletedAt: true,
  author: { select: { displayName: true } },
  _count: { select: { attachments: true } },
} satisfies Prisma.MessageSelect;

type MessageReferenceRow = Prisma.MessageGetPayload<{ select: typeof messageReferenceSelect }>;

function toMessageReference(row: MessageReferenceRow | null): MessageReference | null {
  if (!row) return null;
  return {
    id: row.id,
    content: row.deletedAt ? '' : row.content,
    authorName: row.author?.displayName ?? 'Unknown',
    attachmentCount: row._count.attachments,
    deleted: Boolean(row.deletedAt),
  };
}

/** Message graph needed to render a bubble. Scoped to the viewer for stars. */
export function messageInclude(viewerId: string) {
  return {
    author: { select: publicUserSelect },
    attachments: { orderBy: { createdAt: 'asc' } },
    reactions: { select: { emoji: true, userId: true } },
    replyTo: { select: messageReferenceSelect },
    forwardedFrom: { select: messageReferenceSelect },
    stars: { where: { userId: viewerId }, select: { userId: true } },
    // Counted rather than loaded: the main view only needs the number, and the
    // replies themselves are fetched when the thread is opened.
    _count: { select: { replies: true } },
    linkPreview: {
      select: { url: true, title: true, description: true, imageUrl: true, siteName: true },
    },
    poll: {
      select: {
        id: true,
        question: true,
        multiple: true,
        closedAt: true,
        options: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            label: true,
            // Counting in the query beats loading every vote row to length it,
            // and the viewer's own vote is a targeted lookup rather than a scan.
            _count: { select: { votes: true } },
            votes: { where: { userId: viewerId }, select: { userId: true } },
          },
        },
      },
    },
  } satisfies Prisma.MessageInclude;
}

export type MessageRow = Prisma.MessageGetPayload<{
  include: ReturnType<typeof messageInclude>;
}>;

function toAttachment(row: MessageRow['attachments'][number]): AttachmentDTO {
  return {
    id: row.id,
    kind: row.kind,
    url: row.url,
    path: row.path,
    name: row.name,
    size: row.size,
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
    duration: row.duration,
    waveform: row.waveform,
  };
}

function groupReactions(
  rows: Array<{ emoji: string; userId: string }>,
  viewerId: string,
): ReactionGroup[] {
  const groups = new Map<string, ReactionGroup>();
  for (const row of rows) {
    const group = groups.get(row.emoji) ?? {
      emoji: row.emoji,
      count: 0,
      userIds: [],
      reactedByMe: false,
    };
    group.count += 1;
    group.userIds.push(row.userId);
    if (row.userId === viewerId) group.reactedByMe = true;
    groups.set(row.emoji, group);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
}

export function toMessage(row: MessageRow, viewerId: string): MessageDTO {
  const deleted = Boolean(row.deletedAt);
  return {
    id: row.id,
    conversationId: row.conversationId,
    kind: row.kind,
    content: deleted ? '' : row.content,
    author: row.author ? toPublicUser(row.author) : null,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    pinnedAt: row.pinnedAt?.toISOString() ?? null,
    replyTo: toMessageReference(row.replyTo),
    forwardedFrom: toMessageReference(row.forwardedFrom),
    attachments: deleted ? [] : row.attachments.map(toAttachment),
    reactions: deleted ? [] : groupReactions(row.reactions, viewerId),
    starred: row.stars.length > 0,
    replyCount: row._count.replies,
    linkPreview: deleted ? null : row.linkPreview,
    poll:
      deleted || !row.poll
        ? null
        : {
            id: row.poll.id,
            question: row.poll.question,
            multiple: row.poll.multiple,
            closed: Boolean(row.poll.closedAt),
            totalVotes: row.poll.options.reduce((sum, option) => sum + option._count.votes, 0),
            options: row.poll.options.map((option) => ({
              id: option.id,
              label: option.label,
              votes: option._count.votes,
              votedByMe: option.votes.length > 0,
            })),
          },
  };
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export const memberInclude = {
  user: { select: publicUserSelect },
} satisfies Prisma.ConversationMemberInclude;

export type MemberRow = Prisma.ConversationMemberGetPayload<{ include: typeof memberInclude }>;

export function toMember(row: MemberRow): MemberDTO {
  return {
    id: row.id,
    role: row.role,
    nickname: row.nickname,
    joinedAt: row.joinedAt.toISOString(),
    lastReadMessageId: row.lastReadMessageId,
    lastReadAt: row.lastReadAt?.toISOString() ?? null,
    user: toPublicUser(row.user),
  };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notificationInclude = {
  actor: { select: publicUserSelect },
} satisfies Prisma.NotificationInclude;

export type NotificationRow = Prisma.NotificationGetPayload<{ include: typeof notificationInclude }>;

export function toNotification(row: NotificationRow): NotificationDTO {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    conversationId: row.conversationId,
    messageId: row.messageId,
    actor: row.actor ? toPublicUser(row.actor) : null,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
