'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowUpRight, Star, StarOff } from 'lucide-react';

import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { formatFullTimestamp } from '@/lib/date';
import { MessageContent } from '@/features/messages/components/message-content';
import { AttachmentGrid } from '@/features/media/components/attachment-grid';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import type { MessageDTO } from '@/types/dto';
import { useT } from '@/i18n/provider';

export function StarredMessages() {
  const t = useT();
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery({
    queryKey: queryKeys.starred,
    queryFn: () =>
      api<{ messages: MessageDTO[] }>('/messages/starred').then((data) => data.messages),
  });

  const unstar = useMutation({
    mutationFn: (id: string) =>
      api(`/messages/${id}/star`, { method: 'POST', body: { starred: false } }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.starred });
      const previous = queryClient.getQueryData<MessageDTO[]>(queryKeys.starred);
      queryClient.setQueryData<MessageDTO[]>(queryKeys.starred, (list) =>
        list?.filter((message) => message.id !== id),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.starred, context.previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.starred }),
  });

  return (
    <div className="panel flex h-full flex-col overflow-hidden rounded-[var(--radius-panel)] shadow-[var(--shadow-raised)]">
      <header className="border-b border-[var(--hairline)] p-5 pb-4">
        <h1 className="text-xl font-semibold tracking-tight">{t.message.starred}</h1>
        <p className="mt-1 text-[13px] text-[var(--text-2)]">
          {t.message.starredHint}
        </p>
      </header>

      <div className="scroll-area flex-1 overflow-y-auto p-5 pb-24 lg:pb-5">
        {isLoading ? (
          <div className="mx-auto grid max-w-2xl gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-[var(--radius-card)]" />
            ))}
          </div>
        ) : !messages || messages.length === 0 ? (
          <EmptyState
            icon={<Star />}
            title={t.message.nothingStarred}
            description={t.message.nothingStarredHint}
          />
        ) : (
          <ul className="mx-auto grid max-w-2xl gap-3">
            {messages.map((message, index) => (
              <motion.li
                key={message.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.25) }}
                className="group rounded-[var(--radius-card)] border border-[var(--hairline)] bg-[var(--surface)] p-4"
              >
                <div className="flex items-start gap-3">
                  <Avatar
                    src={message.author?.avatarUrl}
                    name={message.author?.displayName ?? '?'}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[13px] font-semibold">
                        {message.author?.displayName ?? t.message.unknown}
                      </p>
                      <time className="shrink-0 text-[11px] text-[var(--text-3)]">
                        {formatFullTimestamp(message.createdAt)}
                      </time>
                    </div>

                    {message.attachments.length > 0 ? (
                      <div className="mt-2">
                        <AttachmentGrid attachments={message.attachments} mine={false} />
                      </div>
                    ) : null}

                    {message.content ? (
                      <MessageContent content={message.content} className="mt-1 text-[13.5px]" />
                    ) : null}

                    <div className="mt-3 flex items-center gap-2">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/chat/${message.conversationId}?m=${message.id}`}>
                          <ArrowUpRight />
                          {t.message.jumpTo}
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => unstar.mutate(message.id)}
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <StarOff />
                        {t.message.remove}
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
