'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { api } from '@/lib/api-client';
import { formatRelative } from '@/lib/date';
import { Avatar } from '@/components/ui/avatar';
import { MessageContent } from '@/features/messages/components/message-content';
import { PollCard } from '@/features/messages/components/poll-card';
import { AttachmentGrid } from '@/features/media/components/attachment-grid';
import type { MessageDTO } from '@/types/dto';

type Thread = { root: MessageDTO; replies: MessageDTO[]; nextCursor: string | null };

function ThreadMessage({ message }: { message: MessageDTO }) {
  const deleted = Boolean(message.deletedAt);

  return (
    <li className="flex gap-2.5">
      <Avatar
        src={message.author?.avatarUrl ?? null}
        name={message.author?.displayName ?? 'Someone'}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="truncate text-[13px] font-medium">
            {message.author?.displayName ?? 'Someone'}
          </span>
          <span className="shrink-0 text-[11px] text-[var(--text-3)]">
            {formatRelative(message.createdAt)}
          </span>
        </p>

        {deleted ? (
          <p className="text-[13px] italic text-[var(--text-3)]">Message deleted</p>
        ) : (
          <>
            {message.attachments.length > 0 ? (
              <div className="mt-1">
                <AttachmentGrid attachments={message.attachments} mine={false} />
              </div>
            ) : null}
            {message.poll ? (
              <PollCard messageId={message.id} poll={message.poll} />
            ) : message.content ? (
              <MessageContent content={message.content} className="text-[13px]" />
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}

/**
 * One branch of the conversation.
 *
 * Replies are still shown inline in the main view — this focuses a branch
 * rather than hiding it, which is what makes three parallel topics followable
 * without making a single reply easy to miss.
 */
export function ThreadPanel({ rootId }: { rootId: string }) {
  // Paginado y no un `take` grande: antes traia doscientas respuestas y ahi se
  // acababa, sin decir que faltaban. Un tope que trunca en silencio es lo peor
  // de las dos opciones — ni lo enseña entero ni avisa.
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['thread', rootId],
      queryFn: ({ pageParam }) =>
        api<Thread>(
          `/messages/${rootId}/thread${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`,
        ),
      initialPageParam: null as string | null,
      getNextPageParam: (last) => last.nextCursor,
    });

  const root = data?.pages[0]?.root;
  const replies = data?.pages.flatMap((page) => page.replies) ?? [];

  if (isLoading) {
    return (
      <div className="grid place-items-center py-8">
        <Loader2 className="size-4 animate-spin text-[var(--text-3)]" />
      </div>
    );
  }

  if (isError || !root) {
    return <p className="p-4 text-[13px] text-[var(--text-3)]">This thread is not available.</p>;
  }

  return (
    <div className="p-3">
      <ul className="space-y-3">
        <ThreadMessage message={root} />
      </ul>

      <p className="my-3 border-t border-[var(--hairline)] pt-3 text-[11px] uppercase tracking-wider text-[var(--text-3)]">
        {replies.length}
        {hasNextPage ? '+' : ''} {replies.length === 1 ? 'reply' : 'replies'}
      </p>

      {replies.length === 0 ? (
        <p className="text-[13px] text-[var(--text-3)]">
          Reply to this message and it will show up here.
        </p>
      ) : (
        <ul className="space-y-3">
          {replies.map((reply) => (
            <ThreadMessage key={reply.id} message={reply} />
          ))}
        </ul>
      )}

      {hasNextPage ? (
        <button
          type="button"
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mt-3 w-full rounded-[var(--radius-field)] border border-[var(--hairline)] py-2 text-[12px] text-[var(--text-2)] transition-colors hover:border-[var(--hairline-strong)] disabled:opacity-60"
        >
          {isFetchingNextPage ? 'Loading…' : 'Load older replies'}
        </button>
      ) : null}
    </div>
  );
}
