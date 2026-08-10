'use client';

import * as React from 'react';
import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  AtSign,
  Bell,
  BellOff,
  CheckCheck,
  Heart,
  MessageSquare,
  UserPlus,
  Users,
} from 'lucide-react';
import type { NotificationKind } from '@prisma/client';

import { cn } from '@/lib/utils';
import { useNotificationActions, useNotifications } from '@/features/notifications/hooks';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';

const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  MESSAGE: MessageSquare,
  MENTION: AtSign,
  REACTION: Heart,
  FRIEND_REQUEST: UserPlus,
  FRIEND_ACCEPTED: UserPlus,
  GROUP_INVITE: Users,
  JOIN_REQUEST: Users,
  SYSTEM: Bell,
};

export function NotificationBell({ side = 'right' }: { side?: 'right' | 'top' | 'bottom' }) {
  const [open, setOpen] = React.useState(false);
  const { data, isLoading } = useNotifications();
  const { markAllRead, markRead } = useNotificationActions();

  const unread = data?.unread ?? 0;
  const notifications = data?.notifications ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content="Notifications" side={side === 'right' ? 'right' : 'top'}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'relative grid size-9 place-items-center rounded-full text-[var(--text-2)]',
              'transition-colors duration-200 ease-[var(--ease-out)]',
              'hover:bg-[var(--surface-hover)] hover:text-[var(--accent-mint)]',
              open && 'bg-[var(--surface-active)] text-[var(--text-1)]',
            )}
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          >
            <Bell className="size-[18px]" />
            {/* A dot, not a springing pill. The count is one click away. */}
            {unread > 0 ? (
              <span
                className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[var(--accent-mint)] shadow-[0_0_8px_var(--accent-mint)]"
                aria-hidden
              />
            ) : null}
          </button>
        </PopoverTrigger>
      </Tooltip>

      <PopoverContent
        side={side}
        align={side === 'right' ? 'end' : 'center'}
        className="w-[22rem] p-0"
      >
        <header className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-3">
          <h2 className="label-caps">Notifications</h2>
          {unread > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead.mutate()}
              loading={markAllRead.isPending}
            >
              <CheckCheck />
              Mark all read
            </Button>
          ) : null}
        </header>

        <div className="scroll-area max-h-[26rem] overflow-y-auto p-1.5">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex gap-3">
                  <Skeleton className="size-9 rounded-[var(--radius-field)]" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-2.5 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState
              compact
              icon={<BellOff />}
              title="All quiet"
              description="Mentions, reactions and new messages land here."
            />
          ) : (
            <ul className="space-y-0.5">
              {notifications.map((notification) => {
                const Icon = KIND_ICON[notification.kind];
                const unreadItem = !notification.readAt;
                const href = notification.conversationId
                  ? `/chat/${notification.conversationId}`
                  : notification.actor
                    ? `/u/${notification.actor.username}`
                    : '/chat';

                return (
                  <li key={notification.id}>
                    <Link
                      href={href}
                      onClick={() => {
                        if (unreadItem) markRead.mutate(notification.id);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex gap-3 rounded-[var(--radius-field)] p-2.5 transition-colors duration-150',
                        'hover:bg-[var(--surface-hover)]',
                        unreadItem && 'bg-[var(--accent-quiet)]',
                      )}
                    >
                      <span className="relative shrink-0">
                        <Avatar
                          src={notification.actor?.avatarUrl}
                          name={notification.actor?.displayName ?? 'Pulse'}
                          size="sm"
                        />
                        <span className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full bg-[var(--surface-solid)] text-[var(--accent)]">
                          <Icon className="size-2.5" />
                        </span>
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-[var(--text-1)]">
                          {notification.title}
                        </p>
                        {notification.body ? (
                          <p className="line-clamp-2 text-[12px] leading-snug text-[var(--text-2)]">
                            {notification.body}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-[11px] text-[var(--text-3)]">
                          {formatDistanceToNowStrict(new Date(notification.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>

                      {unreadItem ? (
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--accent)]" />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
