'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useMutation } from '@tanstack/react-query';
import {
  Check,
  Circle,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  UserRound,
} from 'lucide-react';
import type { Presence } from '@prisma/client';

import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Avatar, PRESENCE_COLOR, PRESENCE_LABEL } from '@/components/ui/avatar';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { useSession, useUpdateSessionCache } from '@/components/providers/session-provider';

const PRESENCE_OPTIONS: Presence[] = ['ONLINE', 'IDLE', 'DND', 'OFFLINE'];

export function UserMenu({ align = 'start' }: { align?: 'start' | 'center' | 'end' }) {
  const me = useSession();
  const patchSession = useUpdateSessionCache();
  const { theme, setTheme } = useTheme();

  const setPresence = useMutation({
    mutationFn: (presence: Presence) => api('/me', { method: 'PATCH', body: { presence } }),
    onMutate: (presence) => patchSession({ presence }),
  });

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          className={cn(
            'rounded-full outline-none transition-transform duration-200',
            'hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
          )}
          aria-label="Your account"
        >
          <Avatar src={me.avatarUrl} name={me.displayName} presence={me.presence} size="md" />
        </button>
      </MenuTrigger>

      <MenuContent align={align} side="top" className="w-60">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <Avatar src={me.avatarUrl} name={me.displayName} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[var(--text-1)]">
              {me.displayName}
            </p>
            <p className="truncate text-[11px] text-[var(--text-3)]">@{me.username}</p>
          </div>
        </div>

        <MenuSeparator />
        <MenuLabel>Presence</MenuLabel>
        {PRESENCE_OPTIONS.map((option) => (
          <MenuItem key={option} onSelect={() => setPresence.mutate(option)}>
            <Circle className={cn('size-2.5 rounded-full border-0', PRESENCE_COLOR[option])} fill="currentColor" />
            <span className="flex-1">{PRESENCE_LABEL[option]}</span>
            {me.presence === option ? <Check className="size-3.5" /> : null}
          </MenuItem>
        ))}

        <MenuSeparator />
        <MenuLabel>Appearance</MenuLabel>
        <div className="flex gap-1 px-1 pb-1">
          {(
            [
              { id: 'light', icon: Sun, label: 'Light' },
              { id: 'dark', icon: Moon, label: 'Dark' },
              { id: 'system', icon: Monitor, label: 'System' },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTheme(option.id)}
              aria-pressed={theme === option.id}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 rounded-[var(--radius-field)] px-2 py-2 text-[10px] font-medium',
                'transition-colors duration-150',
                theme === option.id
                  ? 'bg-[var(--surface-sunken)] text-[var(--accent)]'
                  : 'text-[var(--text-3)] hover:bg-[var(--surface-sunken)]',
              )}
            >
              <option.icon className="size-4" />
              {option.label}
            </button>
          ))}
        </div>

        <MenuSeparator />
        <MenuItem asChild>
          <Link href={`/u/${me.username}`}>
            <UserRound />
            View profile
          </Link>
        </MenuItem>
        <MenuItem asChild>
          <Link href="/settings">
            <Settings />
            Settings
          </Link>
        </MenuItem>

        <MenuSeparator />
        <MenuItem danger asChild>
          <form action="/auth/sign-out" method="post" className="w-full">
            <button type="submit" className="flex w-full items-center gap-2.5">
              <LogOut />
              Sign out
            </button>
          </form>
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
