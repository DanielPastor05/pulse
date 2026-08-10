'use client';

import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { Bell, BellOff, Settings } from 'lucide-react';

import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useSession, useUpdateSessionCache } from '@/components/providers/session-provider';
import { Avatar, PRESENCE_LABEL } from '@/components/ui/avatar';
import { Tooltip } from '@/components/ui/tooltip';

/**
 * The identity card that anchors the left column: who you are, your live state,
 * and the two switches you actually reach for. Mic and headset in the reference
 * belong to a voice feature this app does not have, so the slots carry the
 * controls that do exist — notification mute and settings.
 */
export function UserWidget() {
  const me = useSession();
  const patchSession = useUpdateSessionCache();

  const muted = !me.notifications.onMessage;

  const toggleNotifications = useMutation({
    mutationFn: (next: boolean) =>
      api('/me', { method: 'PATCH', body: { notifyOnMessage: next } }),
    onMutate: (next) =>
      patchSession({ notifications: { ...me.notifications, onMessage: next } }),
  });

  const iconButton = cn(
    'grid size-9 place-items-center rounded-[var(--radius-field)] text-[var(--text-2)]',
    'transition-colors duration-200 hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]',
  );

  return (
    <div className="glass-card relative overflow-hidden rounded-[var(--radius-panel)] p-3">
      <div
        className="pointer-events-none absolute -bottom-8 -right-8 size-24 rounded-full blur-2xl"
        style={{ background: 'var(--accent-glow)', opacity: 0.25 }}
        aria-hidden
      />

      <Link
        href={`/u/${me.username}`}
        className="relative flex items-center gap-3 rounded-[var(--radius-card)] bg-[var(--surface-sunken)] p-2 transition-colors hover:bg-[var(--surface-hover)]"
      >
        <Avatar src={me.avatarUrl} name={me.displayName} size="md" presence={me.presence} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold glow-text-mint">{me.displayName}</p>
          <p className="truncate text-[10px] font-bold uppercase tracking-widest text-[var(--accent-mint)] opacity-80">
            {PRESENCE_LABEL[me.presence]}
          </p>
        </div>
      </Link>

      <div className="relative mt-2 flex items-center justify-around">
        <Tooltip content={muted ? 'Unmute message alerts' : 'Mute message alerts'}>
          <button
            type="button"
            onClick={() => toggleNotifications.mutate(muted)}
            className={cn(iconButton, muted && 'text-[var(--danger)]')}
            aria-pressed={muted}
          >
            {muted ? <BellOff className="size-[18px]" /> : <Bell className="size-[18px]" />}
            <span className="sr-only">{muted ? 'Unmute message alerts' : 'Mute message alerts'}</span>
          </button>
        </Tooltip>

        <Tooltip content="Settings">
          <Link href="/settings" className={iconButton}>
            <Settings className="size-[18px]" />
            <span className="sr-only">Settings</span>
          </Link>
        </Tooltip>
      </div>
    </div>
  );
}
