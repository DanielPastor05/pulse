'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  CheckCheck,
  Hash,
  Paperclip,
  PencilLine,
  Star,
  StarOff,
} from 'lucide-react';

import { cn, truncate } from '@/lib/utils';
import { useDates } from '@/i18n/dates';
import { usePresenceOf } from '@/stores/presence-store';
import { useConversationPreferences } from '@/features/conversations/hooks';
import { Avatar } from '@/components/ui/avatar';
import { CountBadge } from '@/components/ui/misc';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/menu';
import type { ConversationSummary } from '@/types/dto';
import { useT } from '@/i18n/provider';

type Props = {
  conversation: ConversationSummary;
  active: boolean;
  onNavigate?: () => void;
};

function Preview({ conversation }: { conversation: ConversationSummary }) {
  const t = useT();
  if (conversation.draft) {
    return (
      <span className="flex items-center gap-1 text-[var(--warning)]">
        <PencilLine className="size-3 shrink-0" />
        <span className="truncate">{truncate(conversation.draft, 48)}</span>
      </span>
    );
  }

  const last = conversation.lastMessage;
  if (!last) return <span className="italic text-[var(--text-3)]">{t.sidebar.noMessages}</span>;

  const prefix = conversation.type === 'GROUP' && last.authorName ? `${last.authorName}: ` : '';
  const body = last.content || (last.hasAttachments ? t.composer.attachment : '');

  return (
    <span className="flex items-center gap-1 truncate">
      {last.hasAttachments && !last.content ? <Paperclip className="size-3 shrink-0" /> : null}
      <span className="truncate">
        {prefix}
        {truncate(body, 56)}
      </span>
    </span>
  );
}

export const ConversationItem = React.memo(function ConversationItem({
  conversation,
  active,
  onNavigate,
}: Props) {
  const t = useT();
  const { formatListTime } = useDates();
  const preferences = useConversationPreferences(conversation.id);
  const livePresence = usePresenceOf(conversation.peer?.id, conversation.peer?.presence ?? 'OFFLINE');
  const unread = conversation.unreadCount > 0;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {/*
          Rows reorder as messages arrive, but a spring on each one makes the
          whole list breathe every time anybody types. Selection is a flat
          background change — navigation happens too often to animate.
        */}
        <li className="list-none">
          <Link
            href={`/chat/${conversation.id}`}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group relative flex items-center gap-2.5 rounded-[var(--radius-field)] px-2 py-[7px]',
              'transition-colors duration-[120ms] ease-[var(--ease-out)]',
              active ? 'bg-[var(--surface-active)]' : 'hover:bg-[var(--surface-hover)]',
            )}
          >
            {active ? (
              <span
                className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-[var(--accent)]"
                aria-hidden
              />
            ) : null}

            <div className="relative shrink-0">
              {conversation.type === 'GROUP' && !conversation.avatarUrl ? (
                <span className="grid size-9 place-items-center rounded-full border border-[var(--hairline-strong)] bg-[var(--surface-sunken)] text-[var(--text-2)]">
                  <Hash className="size-4" />
                </span>
              ) : (
                <Avatar
                  src={conversation.avatarUrl}
                  name={conversation.name}
                  size="md"
                  presence={conversation.type === 'DIRECT' ? livePresence : undefined}
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <p
                  className={cn(
                    'flex-1 truncate text-[14px]',
                    unread ? 'font-semibold text-[var(--text-1)]' : 'font-medium text-[var(--text-1)]',
                  )}
                >
                  {conversation.name}
                </p>
                <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-3)]">
                  {formatListTime(conversation.lastMessageAt)}
                </span>
              </div>

              <div className="mt-0.5 flex items-center gap-2">
                <div
                  className={cn(
                    'min-w-0 flex-1 truncate text-[12.5px]',
                    unread ? 'text-[var(--text-1)]' : 'text-[var(--text-2)]',
                  )}
                >
                  <Preview conversation={conversation} />
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {conversation.favorite ? (
                    <Star className="size-3 fill-[var(--warning)] text-[var(--warning)]" />
                  ) : null}
                  {conversation.muted ? <BellOff className="size-3 text-[var(--text-3)]" /> : null}
                  <CountBadge count={conversation.unreadCount} />
                </div>
              </div>
            </div>
          </Link>
        </li>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem
          onSelect={() => preferences.mutate({ favorite: !conversation.favorite })}
        >
          {conversation.favorite ? <StarOff /> : <Star />}
          {conversation.favorite ? t.conversation.favoriteRemove : t.conversation.favoriteAdd}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => preferences.mutate({ muted: !conversation.muted })}>
          {conversation.muted ? <Bell /> : <BellOff />}
          {conversation.muted ? 'Unmute' : t.conversation.muteNotifications}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => preferences.mutate({ archived: !conversation.archived })}>
          {conversation.archived ? <ArchiveRestore /> : <Archive />}
          {conversation.archived ? t.conversation.toInbox : t.conversation.archive}
        </ContextMenuItem>
        {conversation.lastMessage && unread ? (
          <ContextMenuItem asChild>
            <Link href={`/chat/${conversation.id}`}>
              <CheckCheck />
              {t.message.openMarkRead}
            </Link>
          </ContextMenuItem>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
});
