'use client';

import { useMutation } from '@tanstack/react-query';
import { Check, Lock } from 'lucide-react';
import { toast } from 'sonner';

import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { MessageDTO, PollDTO } from '@/types/dto';

/**
 * A poll inside a message bubble.
 *
 * Results are visible from the start rather than hidden until you vote. In a
 * group of friends deciding where to eat, seeing what everyone else picked is
 * the point; hiding it belongs to surveys, not chats.
 */
export function PollCard({ messageId, poll }: { messageId: string; poll: PollDTO }) {
  const vote = useMutation({
    mutationFn: (optionId: string) =>
      api<MessageDTO>(`/messages/${messageId}/poll`, { method: 'POST', body: { optionId } }),
    // The realtime broadcast updates every client including this one, so there
    // is nothing to write into the cache here.
    onError: (error) => toast.error('Could not vote', { description: error.message }),
  });

  return (
    <div className="mt-1 w-full max-w-sm">
      <p className="flex items-start gap-1.5 text-[14px] font-medium">
        {poll.closed ? <Lock className="mt-0.5 size-3.5 shrink-0 opacity-60" /> : null}
        {poll.question}
      </p>

      <ul className="mt-2 space-y-1.5">
        {poll.options.map((option) => {
          // Share of the vote, not of the people: with multiple choice these
          // deliberately add up to more than 100%.
          const share = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;

          return (
            <li key={option.id}>
              <button
                type="button"
                disabled={poll.closed || vote.isPending}
                onClick={() => vote.mutate(option.id)}
                aria-pressed={option.votedByMe}
                className={cn(
                  'relative w-full overflow-hidden rounded-[var(--radius-field)] px-2.5 py-1.5 text-left',
                  'border transition-colors disabled:cursor-default',
                  option.votedByMe
                    ? 'border-[var(--accent)]'
                    : 'border-[var(--hairline)] hover:border-[var(--text-3)]',
                )}
              >
                {/* The bar sits behind the label so the text never reflows as
                    numbers change. */}
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 bg-[var(--surface-sunken)] transition-[width] duration-300"
                  style={{ width: `${share}%` }}
                />
                <span className="relative flex items-center gap-1.5 text-[13px]">
                  {option.votedByMe ? (
                    <Check className="size-3.5 shrink-0 text-[var(--accent)]" />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-3)]">
                    {option.votes}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-1.5 text-[11px] text-[var(--text-3)]">
        {poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}
        {poll.multiple ? ' · pick as many as you like' : ''}
        {poll.closed ? ' · closed' : ''}
      </p>
    </div>
  );
}
