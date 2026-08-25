import type {
  Locale,
  AttachmentKind,
  ConversationType,
  JoinRequestStatus,
  MemberRole,
  MessageKind,
  NotificationKind,
  Presence,
  ReportReason,
  ReportStatus,
  RelationshipStatus,
  ThemePreference,
} from '@prisma/client';

/** Everything the UI is allowed to know about someone else. */
export type PublicUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bannerColor: string;
  bio: string | null;
  statusText: string | null;
  presence: Presence;
  lastSeenAt: string;
};

export type CurrentUser = PublicUser & {
  email: string;
  locale: Locale;
  theme: ThemePreference;
  accent: string;
  reducedMotion: boolean;
  onboardedAt: string | null;
  notifications: {
    onMessage: boolean;
    onMention: boolean;
    onReaction: boolean;
    sounds: boolean;
    desktopPush: boolean;
  };
};

export type AttachmentDTO = {
  id: string;
  kind: AttachmentKind;
  url: string;
  path: string;
  name: string;
  size: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  waveform: number[];
};

export type ReactionGroup = {
  emoji: string;
  count: number;
  userIds: string[];
  reactedByMe: boolean;
};

export type MessageReference = {
  id: string;
  content: string;
  authorName: string;
  attachmentCount: number;
  deleted: boolean;
};

export type MessageDTO = {
  id: string;
  conversationId: string;
  kind: MessageKind;
  content: string;
  author: PublicUser | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  pinnedAt: string | null;
  replyTo: MessageReference | null;
  forwardedFrom: MessageReference | null;
  attachments: AttachmentDTO[];
  reactions: ReactionGroup[];
  starred: boolean;
  /** How many replies hang off this one, for the thread affordance. */
  replyCount: number;
  /** Resolved after the message is stored, so it arrives on a later update. */
  linkPreview: LinkPreviewDTO | null;
  /** Present only on messages of kind POLL. */
  poll: PollDTO | null;
  /** Client-only: set on optimistic messages that have not been confirmed. */
  pending?: boolean;
  failed?: boolean;
  /**
   * Waiting for the connection to come back, which is different from failed:
   * nothing is wrong and nobody needs to press anything.
   */
  queued?: boolean;
};

export type ReportDTO = {
  id: string;
  reason: ReportReason;
  note: string | null;
  status: ReportStatus;
  createdAt: string;
  reviewedAt: string | null;
  reporter: PublicUser;
  reportedUser: PublicUser | null;
  message: { id: string; content: string; deleted: boolean } | null;
};

export type PollDTO = {
  id: string;
  question: string;
  multiple: boolean;
  closed: boolean;
  totalVotes: number;
  options: Array<{
    id: string;
    label: string;
    votes: number;
    /** Viewer-specific, like `starred` — recomputed per request. */
    votedByMe: boolean;
  }>;
};

export type LinkPreviewDTO = {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
};

export type MemberDTO = {
  id: string;
  role: MemberRole;
  nickname: string | null;
  joinedAt: string;
  lastReadMessageId: string | null;
  /** Read receipts are derived by comparing this against message timestamps. */
  lastReadAt: string | null;
  user: PublicUser;
};

export type ConversationSummary = {
  id: string;
  type: ConversationType;
  name: string;
  slug: string | null;
  description: string | null;
  avatarUrl: string | null;
  accent: string;
  isPublic: boolean;
  lastMessageAt: string;
  unreadCount: number;
  memberCount: number;
  favorite: boolean;
  archived: boolean;
  muted: boolean;
  draft: string | null;
  /** El fondo del hilo, de quien mira y no del grupo. `null` es sin fondo. */
  background: string | null;
  role: MemberRole;
  /** For direct conversations: the person on the other side. */
  peer: PublicUser | null;
  lastMessage: {
    id: string;
    content: string;
    authorName: string | null;
    createdAt: string;
    hasAttachments: boolean;
  } | null;
};

/**
 * Un mensaje escrito para más tarde. No lleva autor porque sólo se ven los
 * propios: pedir los de otro no devuelve una lista vacía, devuelve la tuya.
 */
export type ScheduledMessageDTO = {
  id: string;
  conversationId: string;
  content: string;
  replyToId: string | null;
  scheduledFor: string;
  createdAt: string;
};

export type ConversationDetail = ConversationSummary & {
  requiresApproval: boolean;
  ownerId: string | null;
  members: MemberDTO[];
  pendingJoinRequests: number;
  blockedByMe: boolean;
  blockedMe: boolean;
};

export type NotificationDTO = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  conversationId: string | null;
  messageId: string | null;
  actor: PublicUser | null;
  readAt: string | null;
  createdAt: string;
};

export type RelationshipDTO = {
  id: string;
  status: RelationshipStatus;
  direction: 'incoming' | 'outgoing';
  user: PublicUser;
  createdAt: string;
};

export type JoinRequestDTO = {
  id: string;
  status: JoinRequestStatus;
  message: string | null;
  createdAt: string;
  user: PublicUser;
};

export type GalleryItem = {
  id: string;
  kind: AttachmentKind;
  url: string;
  name: string;
  size: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  createdAt: string;
  /** So tapping an item can jump to where it was sent. */
  messageId: string;
  author: { id: string; displayName: string } | null;
};

export type Paginated<T> = {
  items: T[];
  nextCursor: string | null;
};

export type SearchResults = {
  users: PublicUser[];
  conversations: ConversationSummary[];
  /**
   * Cursor for the next page of message results, or null when there are none.
   *
   * Only messages paginate: they are the set that grows without bound. People,
   * conversations and files are capped at a page because a query matching more
   * than twenty of those is a query worth rewording.
   */
  nextCursor: string | null;
  messages: Array<{
    message: MessageDTO;
    conversation: { id: string; name: string; type: ConversationType; avatarUrl: string | null };
  }>;
  files: Array<{
    attachment: AttachmentDTO;
    messageId: string;
    conversationId: string;
    conversationName: string;
    createdAt: string;
  }>;
};
