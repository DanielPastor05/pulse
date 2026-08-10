'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Archive,
  Bell,
  BellOff,
  Hash,
  Info,
  LogOut,
  Pin,
  Search,
  Star,
  StarOff,
  UserRoundPlus,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatLastSeen } from '@/lib/date';
import { usePresenceOf } from '@/stores/presence-store';
import { useUiStore } from '@/stores/ui-store';
import { useConversationPreferences, useMemberMutations } from '@/features/conversations/hooks';
import { Avatar, PRESENCE_LABEL } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Tooltip } from '@/components/ui/tooltip';
import type { ConversationDetail } from '@/types/dto';

export function ChatHeader({
  conversation,
  meId,
  typingCount,
}: {
  conversation: ConversationDetail;
  meId: string;
  typingCount: number;
}) {
  const preferences = useConversationPreferences(conversation.id);
  const { leave } = useMemberMutations(conversation.id);
  const { rightPanel, toggleRightPanel } = useUiStore();

  const peerPresence = usePresenceOf(
    conversation.peer?.id,
    conversation.peer?.presence ?? 'OFFLINE',
  );

  const subtitle = (() => {
    if (typingCount > 0) return 'typing…';
    if (conversation.type === 'GROUP') {
      return `${conversation.memberCount} member${conversation.memberCount === 1 ? '' : 's'}`;
    }
    if (!conversation.peer) return null;
    return peerPresence === 'ONLINE'
      ? PRESENCE_LABEL.ONLINE
      : formatLastSeen(conversation.peer.lastSeenAt);
  })();

  return (
    <header className="flex items-center gap-3 border-b border-[var(--hairline)] px-3 py-2.5 sm:px-4">
      <Button asChild size="icon-sm" variant="ghost" className="lg:hidden" aria-label="Back to chats">
        <Link href="/chat">
          <ArrowLeft />
        </Link>
      </Button>

      <button
        type="button"
        onClick={() => toggleRightPanel('details')}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-field)] p-1 text-left transition-colors hover:bg-[var(--surface-sunken)]"
      >
        {conversation.type === 'GROUP' && !conversation.avatarUrl ? (
          <span className="bg-[var(--accent)] grid size-10 shrink-0 place-items-center rounded-full text-white">
            <Hash className="size-5" />
          </span>
        ) : (
          <Avatar
            src={conversation.avatarUrl}
            name={conversation.name}
            size="md"
            presence={conversation.type === 'DIRECT' ? peerPresence : undefined}
          />
        )}

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold">{conversation.name}</span>
            {conversation.favorite ? (
              <Star className="size-3.5 shrink-0 fill-[var(--warning)] text-[var(--warning)]" />
            ) : null}
            {conversation.muted ? <BellOff className="size-3.5 shrink-0 text-[var(--text-3)]" /> : null}
          </span>
          {subtitle ? (
            <span
              className={cn(
                'block truncate text-[12px]',
                typingCount > 0 ? 'text-[var(--accent)]' : 'text-[var(--text-3)]',
              )}
            >
              {subtitle}
            </span>
          ) : null}
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-0.5">
        <Tooltip content="Search in conversation" shortcut="⌘F">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => toggleRightPanel('search')}
            aria-label="Search in conversation"
            className={cn(rightPanel === 'search' && 'bg-[var(--surface-sunken)] text-[var(--text-1)]')}
          >
            <Search />
          </Button>
        </Tooltip>

        <Tooltip content="Pinned messages">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => toggleRightPanel('pins')}
            aria-label="Pinned messages"
            className={cn(rightPanel === 'pins' && 'bg-[var(--surface-sunken)] text-[var(--text-1)]')}
          >
            <Pin />
          </Button>
        </Tooltip>

        <Tooltip content="Details">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => toggleRightPanel('details')}
            aria-label="Conversation details"
            className={cn(rightPanel === 'details' && 'bg-[var(--surface-sunken)] text-[var(--text-1)]')}
          >
            <Info />
          </Button>
        </Tooltip>

        <Menu>
          <MenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="Conversation options">
              <span className="text-lg leading-none">⋯</span>
            </Button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onSelect={() => preferences.mutate({ favorite: !conversation.favorite })}>
              {conversation.favorite ? <StarOff /> : <Star />}
              {conversation.favorite ? 'Remove from favourites' : 'Add to favourites'}
            </MenuItem>
            <MenuItem onSelect={() => preferences.mutate({ muted: !conversation.muted })}>
              {conversation.muted ? <Bell /> : <BellOff />}
              {conversation.muted ? 'Unmute' : 'Mute notifications'}
            </MenuItem>
            <MenuItem onSelect={() => preferences.mutate({ archived: !conversation.archived })}>
              <Archive />
              {conversation.archived ? 'Move to inbox' : 'Archive'}
            </MenuItem>

            {conversation.type === 'GROUP' ? (
              <>
                <MenuSeparator />
                <MenuItem onSelect={() => toggleRightPanel('details')}>
                  <UserRoundPlus />
                  Manage members
                </MenuItem>
                <MenuItem danger onSelect={() => leave.mutate(meId)}>
                  <LogOut />
                  Leave group
                </MenuItem>
              </>
            ) : null}
          </MenuContent>
        </Menu>
      </div>
    </header>
  );
}
