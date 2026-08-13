'use client';

import * as React from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import { api, ApiError } from '@/lib/api-client';
import { dequeue, enqueue } from '@/features/messages/outbox';
import { queryKeys } from '@/lib/query-keys';
import { randomId } from '@/lib/utils';
import type { AttachmentInput } from '@/features/messages/validators';
import type { CurrentUser, MessageDTO, Paginated } from '@/types/dto';

type MessagePages = InfiniteData<Paginated<MessageDTO>, string | null>;

/**
 * History is fetched newest-page-first and paged backwards, which keeps the
 * initial render cheap. `flattenMessages` restores chronological order.
 */
export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.messages(conversationId),
    queryFn: ({ pageParam }) =>
      api<Paginated<MessageDTO>>(`/conversations/${conversationId}/messages`, {
        query: { cursor: pageParam ?? undefined },
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 15_000,
  });
}

export function flattenMessages(
  data: InfiniteData<Paginated<MessageDTO>, unknown> | undefined,
): MessageDTO[] {
  if (!data) return [];
  // pages[0] is the newest window; reverse so the oldest page renders first.
  return [...data.pages].reverse().flatMap((page) => page.items);
}

/** Cache surgery shared by realtime events and mutations. */
export function useMessageCache(conversationId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.messages(conversationId);

  const upsert = React.useCallback(
    (message: MessageDTO, replaceClientId?: string | null) => {
      queryClient.setQueryData<MessagePages>(key, (data) => {
        if (!data) return data;

        let replaced = false;
        const pages = data.pages.map((page) => {
          const items = page.items.map((item) => {
            if (item.id === message.id || (replaceClientId && item.id === replaceClientId)) {
              replaced = true;
              return message;
            }
            return item;
          });
          return { ...page, items };
        });

        if (replaced) return { ...data, pages };

        const [newest, ...rest] = pages;
        if (!newest) return data;
        return { ...data, pages: [{ ...newest, items: [...newest.items, message] }, ...rest] };
      });
    },
    [queryClient, key],
  );

  const remove = React.useCallback(
    (messageId: string) => {
      queryClient.setQueryData<MessagePages>(key, (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === messageId
                ? { ...item, deletedAt: new Date().toISOString(), content: '', attachments: [], reactions: [] }
                : item,
            ),
          })),
        };
      });
    },
    [queryClient, key],
  );

  const patch = React.useCallback(
    (messageId: string, updater: (message: MessageDTO) => MessageDTO) => {
      queryClient.setQueryData<MessagePages>(key, (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => (item.id === messageId ? updater(item) : item)),
          })),
        };
      });
    },
    [queryClient, key],
  );

  return { upsert, remove, patch };
}

export type SendPayload = {
  content: string;
  attachments: AttachmentInput[];
  replyToId?: string | null;
};

export function useSendMessage(conversationId: string, me: CurrentUser) {
  const queryClient = useQueryClient();
  const { upsert, patch } = useMessageCache(conversationId);

  return useMutation({
    mutationFn: (payload: SendPayload & { clientId: string }) =>
      api<MessageDTO>(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: payload,
      }),

    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.messages(conversationId) });

      const optimistic: MessageDTO = {
        id: payload.clientId,
        conversationId,
        kind: 'TEXT',
        content: payload.content,
        author: {
          id: me.id,
          username: me.username,
          displayName: me.displayName,
          avatarUrl: me.avatarUrl,
          bannerColor: me.bannerColor,
          bio: me.bio,
          statusText: me.statusText,
          presence: me.presence,
          lastSeenAt: me.lastSeenAt,
        },
        createdAt: new Date().toISOString(),
        editedAt: null,
        deletedAt: null,
        pinnedAt: null,
        replyTo: null,
        forwardedFrom: null,
        attachments: payload.attachments.map((attachment, index) => ({
          id: `${payload.clientId}-${index}`,
          kind: attachment.kind,
          url: attachment.url,
          path: attachment.path,
          name: attachment.name,
          size: attachment.size,
          mimeType: attachment.mimeType,
          width: attachment.width ?? null,
          height: attachment.height ?? null,
          duration: attachment.duration ?? null,
          waveform: attachment.waveform ?? [],
        })),
        reactions: [],
        starred: false,
        replyCount: 0,
        // Resolved server-side after the send; arrives on a later update.
        linkPreview: null,
        // Optimistic messages are always plain text — polls go through their
        // own endpoint and never render optimistically.
        poll: null,
        pending: true,
      };

      upsert(optimistic);

      // Queued before the request goes out, not after it fails: the tab can be
      // closed mid-flight, and an entry that only exists in memory dies with
      // it. Re-sending a message that did arrive is harmless — the server
      // deduplicates by clientId.
      enqueue({
        clientId: payload.clientId,
        conversationId,
        content: payload.content,
        attachments: payload.attachments,
        replyToId: payload.replyToId ?? null,
        queuedAt: Date.now(),
      });

      return { clientId: payload.clientId };
    },

    onSuccess: (message, payload) => {
      dequeue(payload.clientId);
      upsert(message, payload.clientId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations(false) });
    },

    onError: (error, payload) => {
      // A rejection is not a network problem. Retrying a message the server
      // refused — too long, no longer a member — would retry it forever, so it
      // leaves the queue and is shown as failed.
      const rejected = error instanceof ApiError && error.status < 500;

      if (rejected) {
        dequeue(payload.clientId);
        patch(payload.clientId, (message) => ({ ...message, pending: false, failed: true }));
        toast.error('Message not sent', { description: error.message });
        return;
      }

      // Otherwise it stays queued and goes out when the connection returns.
      patch(payload.clientId, (message) => ({ ...message, pending: false, queued: true }));
    },
  });
}

export function newClientId() {
  return `pending-${randomId(12)}`;
}

export function useMessageActions(conversationId: string) {
  const queryClient = useQueryClient();
  const { upsert, remove, patch } = useMessageCache(conversationId);

  const edit = useMutation({
    mutationFn: (input: { id: string; content: string }) =>
      api<MessageDTO>(`/messages/${input.id}`, { method: 'PATCH', body: { content: input.content } }),
    onSuccess: (message) => upsert(message),
    onError: (error) => toast.error('Could not edit', { description: error.message }),
  });

  const destroy = useMutation({
    mutationFn: (id: string) => api(`/messages/${id}`, { method: 'DELETE' }),
    onMutate: (id) => remove(id),
    onError: (error) => {
      toast.error('Could not delete', { description: error.message });
      void queryClient.invalidateQueries({ queryKey: queryKeys.messages(conversationId) });
    },
  });

  const react = useMutation({
    mutationFn: (input: { id: string; emoji: string }) =>
      api<MessageDTO>(`/messages/${input.id}/reactions`, {
        method: 'POST',
        body: { emoji: input.emoji },
      }),
    onMutate: async ({ id, emoji }) => {
      // Toggle locally first — reactions must feel instant.
      patch(id, (message) => {
        const existing = message.reactions.find((group) => group.emoji === emoji);
        if (!existing) {
          return {
            ...message,
            reactions: [...message.reactions, { emoji, count: 1, userIds: [], reactedByMe: true }],
          };
        }
        const reactions = message.reactions
          .map((group) =>
            group.emoji === emoji
              ? {
                  ...group,
                  count: group.count + (group.reactedByMe ? -1 : 1),
                  reactedByMe: !group.reactedByMe,
                }
              : group,
          )
          .filter((group) => group.count > 0);
        return { ...message, reactions };
      });
    },
    onSuccess: (message) => upsert(message),
    onError: (error) => {
      toast.error('Could not react', { description: error.message });
      void queryClient.invalidateQueries({ queryKey: queryKeys.messages(conversationId) });
    },
  });

  const pin = useMutation({
    mutationFn: (input: { id: string; pinned: boolean }) =>
      api<MessageDTO>(`/messages/${input.id}/pin`, {
        method: 'POST',
        body: { pinned: input.pinned },
      }),
    onSuccess: (message, input) => {
      upsert(message);
      void queryClient.invalidateQueries({ queryKey: queryKeys.pins(conversationId) });
      toast.success(input.pinned ? 'Pinned to this conversation' : 'Unpinned');
    },
    onError: (error) => toast.error('Could not pin', { description: error.message }),
  });

  const star = useMutation({
    mutationFn: (input: { id: string; starred: boolean }) =>
      api<MessageDTO>(`/messages/${input.id}/star`, {
        method: 'POST',
        body: { starred: input.starred },
      }),
    onMutate: ({ id, starred }) => patch(id, (message) => ({ ...message, starred })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.starred }),
    onError: (error) => toast.error('Could not save', { description: error.message }),
  });

  const forward = useMutation({
    mutationFn: (input: { id: string; conversationIds: string[] }) =>
      api<{ delivered: number }>(`/messages/${input.id}/forward`, {
        method: 'POST',
        body: { conversationIds: input.conversationIds },
      }),
    onSuccess: ({ delivered }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations(false) });
      toast.success(`Forwarded to ${delivered} conversation${delivered === 1 ? '' : 's'}`);
    },
    onError: (error) => toast.error('Could not forward', { description: error.message }),
  });

  return { edit, destroy, react, pin, star, forward };
}

export function useMarkRead(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) =>
      api(`/conversations/${conversationId}/read`, { method: 'POST', body: { messageId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations(false) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}
