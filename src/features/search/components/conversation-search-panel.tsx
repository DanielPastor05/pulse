'use client';

import * as React from 'react';
import { Loader2, Search, SearchX } from 'lucide-react';

import { truncate } from '@/lib/utils';
import { useDates } from '@/i18n/dates';
import { useGlobalSearch } from '@/features/search/hooks';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { useT } from '@/i18n/provider';

/**
 * Scoped search: runs the global message search and keeps only the hits that
 * belong to the conversation on screen.
 */
export function ConversationSearchPanel({
  conversationId,
  onJumpTo,
}: {
  conversationId: string;
  onJumpTo: (messageId: string) => void;
}) {
  const t = useT();
  const { formatFullTimestamp } = useDates();
  const [term, setTerm] = React.useState('');
  const { data, isFetching } = useGlobalSearch(term, 'messages');

  const hits = (data?.messages ?? []).filter((hit) => hit.conversation.id === conversationId);
  const searching = term.trim().length >= 2;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--hairline)] p-3">
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={t.message.searchThis}
          icon={isFetching ? <Loader2 className="animate-spin" /> : <Search />}
          className="h-10 text-[13px]"
          autoFocus
        />
      </div>

      <div className="scroll-area flex-1 overflow-y-auto">
        {!searching ? (
          <EmptyState
            compact
            icon={<Search />}
            title={t.message.searchThis}
            description={t.message.searchThisHint}
          />
        ) : hits.length === 0 ? (
          <EmptyState
            compact
            icon={<SearchX />}
            title={t.message.noMatches}
            description={t.message.nothingMentions(term.trim())}
          />
        ) : (
          <ul className="space-y-1 p-2">
            {hits.map(({ message }) => (
              <li key={message.id}>
                <button
                  type="button"
                  onClick={() => onJumpTo(message.id)}
                  className="flex w-full gap-2.5 rounded-[var(--radius-card)] p-2.5 text-left transition-colors hover:bg-[var(--surface-sunken)]"
                >
                  <Avatar
                    src={message.author?.avatarUrl}
                    name={message.author?.displayName ?? '?'}
                    size="xs"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[12px] font-semibold">
                        {message.author?.displayName ?? t.message.unknown}
                      </span>
                      <time className="shrink-0 text-[10.5px] text-[var(--text-3)]">
                        {formatFullTimestamp(message.createdAt)}
                      </time>
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-[var(--text-2)]">
                      {truncate(message.content, 140)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
