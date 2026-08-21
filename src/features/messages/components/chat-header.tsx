'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Archive,
  Bell,
  BellOff,
  Hash,
  Images,
  Info,
  LogOut,
  Phone,
  Pin,
  Search,
  Star,
  StarOff,
  UserRoundPlus,
  Video,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { useDates } from '@/i18n/dates';
import { usePresenceOf } from '@/stores/presence-store';
import { useUiStore } from '@/stores/ui-store';
import { useConversationPreferences, useMemberMutations } from '@/features/conversations/hooks';
import { useCallApi } from '@/features/calls/call-provider';
import { useT } from '@/i18n/provider';
import { Avatar } from '@/components/ui/avatar';
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
  const t = useT();
  const { formatLastSeen } = useDates();
  const preferences = useConversationPreferences(conversation.id);
  const { leave } = useMemberMutations(conversation.id);
  const { startCall, status: callStatus } = useCallApi();
  // One call at a time: a second one would fight the first for the microphone.
  const callBusy = callStatus !== 'idle';
  const { rightPanel, toggleRightPanel } = useUiStore();

  const peerPresence = usePresenceOf(
    conversation.peer?.id,
    conversation.peer?.presence ?? 'OFFLINE',
  );

  const subtitle = (() => {
    if (typingCount > 0) return t.conversation.typing;
    if (conversation.type === 'GROUP') {
      return t.conversation.members(conversation.memberCount);
    }
    if (!conversation.peer) return null;
    return peerPresence === 'ONLINE'
      ? t.common.online
      : formatLastSeen(conversation.peer.lastSeenAt);
  })();

  return (
    <header className="flex items-center gap-3 border-b border-[var(--hairline)] px-3 py-2.5 sm:px-4">
      <Button asChild size="icon-sm" variant="ghost" className="lg:hidden" aria-label={t.conversation.back}>
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
        <Tooltip content={t.call.voice}>
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={callBusy}
            onClick={() => void startCall(conversation.id, conversation.name, 'audio')}
            aria-label={t.conversation.startVoice}
          >
            <Phone />
          </Button>
        </Tooltip>

        <Tooltip content={t.call.video}>
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={callBusy}
            onClick={() => void startCall(conversation.id, conversation.name, 'video')}
            aria-label={t.conversation.startVideo}
          >
            <Video />
          </Button>
        </Tooltip>

        <Tooltip content={t.conversation.searchIn} shortcut="⌘F">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => toggleRightPanel('search')}
            aria-label={t.conversation.searchIn}
            className={cn(rightPanel === 'search' && 'bg-[var(--surface-sunken)] text-[var(--text-1)]')}
          >
            <Search />
          </Button>
        </Tooltip>

        <Tooltip content={t.conversation.photosFiles}>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => toggleRightPanel('gallery')}
            aria-label={t.conversation.sharedPhotos}
            className={cn(rightPanel === 'gallery' && 'bg-[var(--surface-sunken)] text-[var(--text-1)]')}
          >
            <Images />
          </Button>
        </Tooltip>

        <Tooltip content={t.conversation.pinned}>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => toggleRightPanel('pins')}
            aria-label={t.conversation.pinned}
            className={cn(rightPanel === 'pins' && 'bg-[var(--surface-sunken)] text-[var(--text-1)]')}
          >
            <Pin />
          </Button>
        </Tooltip>

        <Tooltip content={t.conversation.details}>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => toggleRightPanel('details')}
            aria-label={t.conversation.detailsLabel}
            className={cn(rightPanel === 'details' && 'bg-[var(--surface-sunken)] text-[var(--text-1)]')}
          >
            <Info />
          </Button>
        </Tooltip>

        <Menu>
          <MenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={t.conversation.options}>
              <span className="text-lg leading-none">⋯</span>
            </Button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onSelect={() => preferences.mutate({ favorite: !conversation.favorite })}>
              {conversation.favorite ? <StarOff /> : <Star />}
              {conversation.favorite ? t.conversation.favoriteRemove : t.conversation.favoriteAdd}
            </MenuItem>
            <MenuItem onSelect={() => preferences.mutate({ muted: !conversation.muted })}>
              {conversation.muted ? <Bell /> : <BellOff />}
              {conversation.muted ? t.conversation.unmute : t.conversation.muteNotifications}
            </MenuItem>
            <MenuItem onSelect={() => preferences.mutate({ archived: !conversation.archived })}>
              <Archive />
              {conversation.archived ? t.conversation.toInbox : t.conversation.archive}
            </MenuItem>

            {conversation.type === 'GROUP' ? (
              <>
                <MenuSeparator />
                <MenuItem onSelect={() => toggleRightPanel('details')}>
                  <UserRoundPlus />
                  {t.conversation.manageMembers}
                </MenuItem>
                <MenuItem danger onSelect={() => leave.mutate(meId)}>
                  <LogOut />
                  {t.conversation.leaveGroup}
                </MenuItem>
              </>
            ) : null}
          </MenuContent>
        </Menu>
      </div>
    </header>
  );
}
