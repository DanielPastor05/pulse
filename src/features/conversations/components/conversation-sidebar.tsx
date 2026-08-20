'use client';

import * as React from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Archive, Inbox, MessagesSquare, Plus, Search, UserRoundPlus, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useConversations } from '@/features/conversations/hooks';
import { ConversationItem } from '@/features/conversations/components/conversation-item';
import { NewConversationDialog } from '@/features/conversations/components/new-conversation-dialog';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { ConversationSkeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { useUiStore } from '@/stores/ui-store';
import { useT } from '@/i18n/provider';
import type { ConversationSummary } from '@/types/dto';

const FILTERS = ['all', 'unread', 'groups', 'archived'] as const;

type FilterId = (typeof FILTERS)[number];

function applyFilter(list: ConversationSummary[], filter: FilterId, term: string) {
  const query = term.trim().toLowerCase();

  return list.filter((conversation) => {
    if (filter === 'unread' && conversation.unreadCount === 0) return false;
    if (filter === 'groups' && conversation.type !== 'GROUP') return false;
    if (!query) return true;

    return (
      conversation.name.toLowerCase().includes(query) ||
      conversation.peer?.username.toLowerCase().includes(query) ||
      conversation.lastMessage?.content.toLowerCase().includes(query)
    );
  });
}

export function ConversationSidebar() {
  const t = useT();
  const params = useParams<{ conversationId?: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [filter, setFilter] = React.useState<FilterId>('all');
  const [term, setTerm] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);

  // `?new=group` from the command palette opens the dialog straight away.
  React.useEffect(() => {
    if (searchParams.get('new')) {
      setDialogOpen(true);
      router.replace('/chat');
    }
  }, [searchParams, router]);

  const { data, isLoading, isError, refetch } = useConversations(filter === 'archived');
  const conversations = React.useMemo(
    () => applyFilter(data ?? [], filter, term),
    [data, filter, term],
  );

  const activeId = params.conversationId;

  return (
    <>
      <div className="panel relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[var(--radius-panel)]">
        <header className="space-y-3 border-b border-[var(--hairline)] p-4 pb-3">
          <div className="flex items-center justify-between">
            <h2 className="label-caps">{t.sidebar.title}</h2>
            <Tooltip content={t.sidebar.newConversationShort}>
              <Button size="icon-sm" onClick={() => setDialogOpen(true)} aria-label={t.sidebar.newConversationShort}>
                <Plus />
              </Button>
            </Tooltip>
          </div>

          <div className="relative">
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder={t.sidebar.filter}
              icon={<Search />}
              className="pr-8"
              aria-label={t.sidebar.filter}
            />
            {term ? (
              <button
                type="button"
                onClick={() => setTerm('')}
                className="absolute inset-y-0 right-1.5 my-auto grid size-5 place-items-center rounded-[var(--radius-control)] text-[var(--text-3)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
                aria-label={t.sidebar.clearFilter}
              >
                <X className="size-3" />
              </button>
            ) : null}
          </div>

          {/*
            Underline tabs with a plain colour change. A pill sliding between
            four filters is the kind of animation you notice on the first click
            and resent by the twentieth.
          */}
          <div role="tablist" aria-label={t.sidebar.filters} className="-mb-px flex gap-4">
            {FILTERS.map((option) => (
              <button
                key={option}
                role="tab"
                aria-selected={filter === option}
                onClick={() => setFilter(option)}
                className={cn(
                  'border-b-2 pb-1.5 text-[12.5px] font-medium',
                  'transition-colors duration-[120ms] ease-[var(--ease-out)]',
                  filter === option
                    ? 'border-[var(--accent)] text-[var(--text-1)]'
                    : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-1)]',
                )}
              >
                {t.sidebar[option]}
              </button>
            ))}
          </div>
        </header>

        <div className="scroll-area flex-1 overflow-y-auto overscroll-contain p-2">
          {isLoading ? (
            <ConversationSkeleton />
          ) : isError ? (
            <EmptyState
              compact
              icon={<MessagesSquare />}
              title={t.sidebar.loadError}
              description={t.sidebar.loadErrorHint}
              action={
                <Button size="sm" variant="secondary" onClick={() => void refetch()}>
                  {t.common.retry}
                </Button>
              }
            />
          ) : conversations.length === 0 ? (
            <EmptyState
              compact
              icon={filter === 'archived' ? <Archive /> : <Inbox />}
              title={
                term
                  ? t.sidebar.nothingMatched
                  : filter === 'archived'
                    ? t.sidebar.noArchived
                    : filter === 'unread'
                      ? t.sidebar.caughtUp
                      : t.sidebar.empty
              }
              description={
                term
                  ? t.sidebar.nothingMatchedHint
                  : filter === 'all'
                    ? t.sidebar.emptyHint
                    : undefined
              }
              action={
                filter === 'all' && !term ? (
                  <Button size="sm" onClick={() => setDialogOpen(true)}>
                    <Plus />
                    {t.sidebar.newConversationShort}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="space-y-px">
              {conversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  active={conversation.id === activeId}
                  onNavigate={() => setMobileNavOpen(false)}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-[var(--hairline)] p-3">
          <Button variant="outline" block onClick={() => setDialogOpen(true)}>
            <UserRoundPlus />
            {t.sidebar.newConversation}
          </Button>
        </div>
      </div>

      <NewConversationDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
