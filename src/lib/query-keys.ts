/** Every cache key in one place so invalidation never guesses. */
export const queryKeys = {
  me: ['me'] as const,

  conversations: (archived = false) => ['conversations', { archived }] as const,
  conversation: (id: string) => ['conversation', id] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const,
  pins: (conversationId: string) => ['pins', conversationId] as const,
  joinRequests: (conversationId: string) => ['join-requests', conversationId] as const,

  starred: ['starred'] as const,
  notifications: ['notifications'] as const,
  relationships: ['relationships'] as const,
  blocked: ['blocked'] as const,

  userSearch: (query: string) => ['user-search', query] as const,
  search: (query: string, scope: string) => ['search', query, scope] as const,
  discover: (query: string) => ['discover', query] as const,
  gifs: (query: string, kind: string) => ['gifs', kind, query] as const,
  profile: (username: string) => ['profile', username] as const,
  invite: (code: string) => ['invite', code] as const,
} as const;
