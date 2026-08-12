'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { api, ApiError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { dequeue, pending } from '@/features/messages/outbox';
import type { MessageDTO } from '@/types/dto';

/**
 * Sends whatever was written while offline.
 *
 * Runs on mount and whenever the connection returns. Mounting matters as much
 * as the event: the usual sequence is losing signal, closing the tab, and
 * opening it again later — by which point the `online` event has long since
 * fired and been missed.
 *
 * Sending is idempotent by `clientId`, so a message that actually did arrive
 * before the failure resolves to the same row rather than posting twice.
 */
export function useOutboxFlush() {
  const queryClient = useQueryClient();
  const flushing = React.useRef(false);

  const flush = React.useCallback(async () => {
    // One at a time: `online` can fire more than once, and two flushes racing
    // would send everything twice. Harmless thanks to idempotency, wasteful
    // anyway.
    if (flushing.current) return;
    flushing.current = true;

    try {
      for (const entry of pending()) {
        try {
          const message = await api<MessageDTO>(
            `/conversations/${entry.conversationId}/messages`,
            {
              method: 'POST',
              body: {
                content: entry.content,
                attachments: entry.attachments,
                replyToId: entry.replyToId,
                clientId: entry.clientId,
              },
            },
          );

          dequeue(entry.clientId);

          queryClient.setQueryData<{ pages: { items: MessageDTO[] }[] }>(
            queryKeys.messages(entry.conversationId),
            (data) => {
              if (!data) return data;
              const pages = data.pages.map((page) => ({
                ...page,
                items: page.items.map((item) => (item.id === entry.clientId ? message : item)),
              }));
              return { ...data, pages };
            },
          );
        } catch (error) {
          // Rejected for a reason that will not change: drop it rather than
          // retry on every reconnect for the rest of time.
          if (error instanceof ApiError && error.status < 500) {
            dequeue(entry.clientId);
            continue;
          }
          // Still no connection. Stop and try again next time.
          break;
        }
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations(false) });
    } finally {
      flushing.current = false;
    }
  }, [queryClient]);

  React.useEffect(() => {
    void flush();

    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [flush]);
}
