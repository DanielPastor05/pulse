'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, Loader2, MessagesSquare } from 'lucide-react';

import { cn } from '@/lib/utils';
import { isSameDayIso } from '@/lib/date';
import { useDates } from '@/i18n/dates';
import { MessageBubble, type MessageActions } from '@/features/messages/components/message-bubble';
import { MessageSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import type { MemberDTO, MessageDTO } from '@/types/dto';
import { useT } from '@/i18n/provider';

const GROUP_WINDOW_MS = 5 * 60_000;
const NEAR_BOTTOM_PX = 120;

type Props = {
  messages: MessageDTO[];
  meId: string;
  members: MemberDTO[];
  canModerate: boolean;
  isLoading: boolean;
  isFetchingOlder: boolean;
  hasOlder: boolean;
  onLoadOlder: () => void;
  actions: MessageActions;
  highlightId?: string | null;
  emptyTitle: string;
  emptyDescription: string;
  /** Reserve room at the bottom for a composer that floats over the thread. */
  floatingComposer?: boolean;
};

function startsNewGroup(current: MessageDTO, previous: MessageDTO | undefined): boolean {
  if (!previous) return true;
  if (previous.kind === 'SYSTEM' || current.kind === 'SYSTEM') return true;
  if (previous.author?.id !== current.author?.id) return true;
  if (!isSameDayIso(previous.createdAt, current.createdAt)) return true;
  return (
    new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime() > GROUP_WINDOW_MS
  );
}

export function MessageList({
  messages,
  meId,
  members,
  canModerate,
  isLoading,
  isFetchingOlder,
  hasOlder,
  onLoadOlder,
  actions,
  highlightId,
  emptyTitle,
  emptyDescription,
  floatingComposer,
}: Props) {
  const t = useT();
  const { formatDaySeparator } = useDates();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const topSentinelRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const [atBottom, setAtBottom] = React.useState(true);
  const [unseen, setUnseen] = React.useState(0);
  const lastMessageId = messages.at(-1)?.id;
  const previousCount = React.useRef(0);
  const restoreHeight = React.useRef<number | null>(null);

  /** Timestamp of the newest message every other member has read. */
  const othersReadThrough = React.useMemo(() => {
    const timestamps = members
      .filter((member) => member.user.id !== meId)
      .map((member) => (member.lastReadAt ? new Date(member.lastReadAt).getTime() : 0));
    return timestamps.length > 0 ? Math.max(...timestamps) : 0;
  }, [members, meId]);

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
    setUnseen(0);
  }, []);

  // Keep the viewport pinned when new messages arrive, unless the reader has
  // scrolled up — then surface a pill instead of yanking them down.
  React.useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    if (restoreHeight.current !== null) {
      container.scrollTop += container.scrollHeight - restoreHeight.current;
      restoreHeight.current = null;
      previousCount.current = messages.length;
      return;
    }

    const grew = messages.length > previousCount.current;
    previousCount.current = messages.length;
    if (!grew) return;

    if (atBottom) bottomRef.current?.scrollIntoView({ block: 'end' });
    else setUnseen((count) => count + 1);
  }, [messages.length, atBottom, lastMessageId]);

  // Jump to a specific message (reply preview, search result, pinned list).
  React.useEffect(() => {
    if (!highlightId) return;
    const element = document.getElementById(`message-${highlightId}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightId, messages.length]);

  React.useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = scrollRef.current;
    if (!sentinel || !container || !hasOlder) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingOlder) {
          restoreHeight.current = container.scrollHeight;
          onLoadOlder();
        }
      },
      { root: container, rootMargin: '240px 0px 0px 0px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasOlder, isFetchingOlder, onLoadOlder]);

  const onScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const distance = target.scrollHeight - target.scrollTop - target.clientHeight;
    const near = distance < NEAR_BOTTOM_PX;
    setAtBottom(near);
    if (near) setUnseen(0);
  }, []);

  if (isLoading) return <MessageSkeleton />;

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className={cn(
          'scroll-area h-full overflow-y-auto overscroll-contain px-3 pt-6 sm:px-6',
          floatingComposer ? 'pb-32' : 'pb-4',
        )}
        role="log"
        aria-live="polite"
        aria-label={t.search.messages}
      >
        <div ref={topSentinelRef} aria-hidden />

        {isFetchingOlder ? (
          <div className="flex justify-center py-3">
            <Loader2 className="size-4 animate-spin text-[var(--accent)]" />
          </div>
        ) : null}

        {!hasOlder && messages.length > 0 ? (
          <p className="py-4 text-center text-[11px] text-[var(--text-3)]">
            {t.conversation.beginning}
          </p>
        ) : null}

        {messages.length === 0 ? (
          <EmptyState
            icon={<MessagesSquare />}
            title={emptyTitle}
            description={emptyDescription}
            className="h-full"
          />
        ) : (
          <ul className="mx-auto w-full max-w-3xl">
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const next = messages[index + 1];
              const newDay = !previous || !isSameDayIso(previous.createdAt, message.createdAt);
              const startsGroup = newDay || startsNewGroup(message, previous);
              const endsGroup = !next || startsNewGroup(next, message);

              return (
                <React.Fragment key={message.id}>
                  {newDay ? (
                    <li className="sticky top-0 z-10 flex justify-center py-3">
                      <span className="panel rounded-full px-3 py-1 text-[11px] font-medium text-[var(--text-2)] shadow-[var(--shadow-raised)]">
                        {formatDaySeparator(message.createdAt)}
                      </span>
                    </li>
                  ) : null}

                  <MessageBubble
                    message={message}
                    mine={message.author?.id === meId}
                    startsGroup={startsGroup}
                    endsGroup={endsGroup}
                    canModerate={canModerate}
                    readByOthers={new Date(message.createdAt).getTime() <= othersReadThrough}
                    highlighted={highlightId === message.id}
                    actions={actions}
                  />
                </React.Fragment>
              );
            })}
          </ul>
        )}

        <div ref={bottomRef} className="h-1" aria-hidden />
      </div>

      <AnimatePresence>
        {!atBottom ? (
          <motion.button
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 480, damping: 30 }}
            type="button"
            onClick={() => scrollToBottom()}
            className={cn(
              // Sits above the floating console rather than under it.
              'absolute bottom-28 left-1/2 z-30 -translate-x-1/2 rounded-full',
              'panel flex items-center gap-2 px-3.5 py-2 text-[12px] font-medium',
              'shadow-[var(--shadow-overlay)] transition-transform hover:scale-105 active:scale-95',
            )}
          >
            <ArrowDown className="size-3.5" />
            {unseen > 0 ? `${unseen} new message${unseen === 1 ? '' : 's'}` : t.message.jumpToLatest}
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
