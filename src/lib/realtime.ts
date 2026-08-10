/** Channel names and realtime event contracts shared by client and server. */

export const realtimeChannels = {
  conversation: (conversationId: string) => `conversation:${conversationId}`,
  user: (userId: string) => `user:${userId}`,
  presence: 'presence:global',
} as const;

export const realtimeEvents = {
  messageCreated: 'message.created',
  messageUpdated: 'message.updated',
  messageDeleted: 'message.deleted',
  reactionChanged: 'reaction.changed',
  typing: 'typing',
  readReceipt: 'read.receipt',
  conversationUpdated: 'conversation.updated',
  memberChanged: 'member.changed',
  notification: 'notification',
  inboxUpdated: 'inbox.updated',
} as const;

export type RealtimeEvent = (typeof realtimeEvents)[keyof typeof realtimeEvents];

export type TypingPayload = {
  userId: string;
  displayName: string;
  conversationId: string;
};

export type ReadReceiptPayload = {
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
  readAt: string;
};
