import type {
  AttachmentKind,
  ConversationType,
  JoinRequestStatus,
  MemberRole,
  MessageKind,
  NotificationKind,
  Presence,
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
  /** Client-only: set on optimistic messages that have not been confirmed. */
  pending?: boolean;
  failed?: boolean;
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

export type Paginated<T> = {
  items: T[];
  nextCursor: string | null;
};

export type SearchResults = {
  users: PublicUser[];
  conversations: ConversationSummary[];
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
