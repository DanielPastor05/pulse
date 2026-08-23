'use client';

import { Pin, PinOff } from 'lucide-react';

import { useDates } from '@/i18n/dates';
import { truncate } from '@/lib/utils';
import { usePinnedMessages } from '@/features/conversations/hooks';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import type { MessageDTO } from '@/types/dto';
import { useT } from '@/i18n/provider';

export function PinnedPanel({
  conversationId,
  onJumpTo,
  onUnpin,
}: {
  conversationId: string;
  onJumpTo: (messageId: string) => void;
  onUnpin: (message: MessageDTO) => void;
}) {
  const t = useT();
  const { formatFullTimestamp } = useDates();
  const { data: messages, isLoading } = usePinnedMessages(conversationId);

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-16 rounded-[var(--radius-card)]" />
        ))}
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <EmptyState
        icon={<Pin />}
        title={t.message.nothingPinned}
        description={t.message.nothingPinnedHint}
      />
    );
  }

  return (
    <ul className="space-y-2 p-3">
      {messages.map((message) => (
        <li
          key={message.id}
          className="group rounded-[var(--radius-card)] bg-[var(--surface-sunken)] p-3 transition-colors hover:bg-[var(--surface)]"
        >
          <div className="flex items-start gap-2.5">
            <Avatar
              src={message.author?.avatarUrl}
              name={message.author?.displayName ?? '?'}
              size="xs"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-[12px] font-semibold">
                  {message.author?.displayName ?? t.message.unknown}
                </p>
                <time className="shrink-0 text-[10.5px] text-[var(--text-3)]">
                  {formatFullTimestamp(message.createdAt)}
                </time>
              </div>
              <button
                type="button"
                onClick={() => onJumpTo(message.id)}
                className="mt-0.5 block w-full text-left text-[13px] leading-snug text-[var(--text-2)] hover:text-[var(--text-1)]"
              >
                {message.content
                  ? truncate(message.content, 160)
                  : t.message.attachments(message.attachments.length)}
              </button>
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              className="opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => onUnpin(message)}
              aria-label={t.message.unpinMessage}
            >
              <PinOff />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
