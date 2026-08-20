'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { Hash, HelpCircle, Pin, Search, Zap } from 'lucide-react';

import { APP_NAME } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from '@/components/layout/nav-items';
import { UserMenu } from '@/components/layout/user-menu';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { useConversation } from '@/features/conversations/hooks';
import { Tooltip } from '@/components/ui/tooltip';
import { useUiStore } from '@/stores/ui-store';
import { useT } from '@/i18n/provider';

/**
 * The floating dock: sections on the left, current context in the middle, tools
 * on the right. It replaces the vertical rail so the three content columns
 * below get the full height of the viewport.
 */
export function TopDock() {
  const t = useT();
  const pathname = usePathname();
  const params = useParams<{ conversationId?: string }>();
  const { commandOpen, toggleCommand, toggleRightPanel } = useUiStore();
  const { data: conversation } = useConversation(params.conversationId);

  const tile = cn(
    'grid size-10 place-items-center rounded-[var(--radius-field)]',
    'transition-all duration-300 ease-[var(--ease-out)] active:scale-95',
  );

  return (
    <header className="panel neon-border z-50 flex shrink-0 items-center justify-between gap-4 rounded-[var(--radius-panel)] p-3">
      <div className="flex min-w-0 items-center gap-4">
        <nav
          aria-label={t.nav.primary}
          className="flex items-center gap-2 border-r border-[var(--hairline)] pr-4"
        >
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <Tooltip key={item.href} content={t.nav[item.label]} side="bottom">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    tile,
                    'relative',
                    active
                      ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-[0_0_15px_var(--accent-glow)]'
                      : 'bg-[var(--surface-sunken)] text-[var(--text-2)] hover:bg-[var(--accent)] hover:text-[var(--on-accent)]',
                  )}
                >
                  <item.icon className="size-[18px]" />
                  {active ? (
                    <span
                      className="absolute -bottom-2 size-1 rounded-full bg-[var(--accent-mint)] shadow-[0_0_8px_var(--accent-mint)]"
                      aria-hidden
                    />
                  ) : null}
                  <span className="sr-only">{t.nav[item.label]}</span>
                </Link>
              </Tooltip>
            );
          })}
        </nav>

        {/* Current context: where you are, in two lines. */}
        <div className="flex min-w-0 items-center gap-3 px-1">
          <Link
            href="/chat"
            aria-label={APP_NAME}
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)] text-[var(--on-accent)] shadow-[0_0_10px_var(--accent-glow)]"
          >
            <Zap className="size-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-bold uppercase tracking-wide glow-text">
              {conversation?.name ?? APP_NAME}
            </h1>
            <p className="flex items-center gap-1 truncate text-[11px] font-semibold uppercase tracking-widest text-[var(--accent)] opacity-80">
              <Hash className="size-3 shrink-0" />
              {conversation
                ? t.conversation.members(conversation.memberCount)
                : t.search.allChannels}
            </p>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {/* Reads as a search field, acts as the command palette trigger. */}
        <button
          type="button"
          onClick={toggleCommand}
          aria-expanded={commandOpen}
          className={cn(
            'hidden h-9 w-64 items-center gap-2 rounded-full px-4 lg:flex',
            'border border-[var(--hairline)] bg-[var(--surface-sunken)]',
            'text-[13px] text-[var(--text-3)]',
            'transition-colors duration-200 hover:border-[var(--accent-line)] hover:text-[var(--text-2)]',
          )}
        >
          <span className="flex-1 text-left">{t.search.signals}</span>
          <Search className="size-4 text-[var(--accent)] opacity-70" />
        </button>

        <div className="flex items-center gap-1">
          <NotificationBell side="bottom" />
          <Tooltip content={t.conversation.pinned} side="bottom">
            <button
              type="button"
              onClick={() => toggleRightPanel('pins')}
              className="grid size-9 place-items-center rounded-full text-[var(--accent)] shadow-[0_0_10px_var(--accent-glow)] transition-colors hover:bg-[var(--accent-quiet)]"
            >
              <Pin className="size-[18px]" />
              <span className="sr-only">{t.conversation.pinned}</span>
            </button>
          </Tooltip>
          <Tooltip content={t.nav.shortcuts} side="bottom">
            <button
              type="button"
              onClick={() => useUiStore.getState().setShortcutsOpen(true)}
              className="grid size-9 place-items-center rounded-full text-[var(--text-2)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--accent-mint)]"
            >
              <HelpCircle className="size-[18px]" />
              <span className="sr-only">{t.nav.shortcuts}</span>
            </button>
          </Tooltip>
        </div>

        <UserMenu align="end" />
      </div>
    </header>
  );
}

/** Mobile navigation: the dock collapses to a bar docked at the bottom. */
export function MobileTabBar() {
  const t = useT();
  const pathname = usePathname();
  const toggleCommand = useUiStore((state) => state.toggleCommand);

  return (
    <nav
      aria-label={t.nav.primary}
      className="panel fixed inset-x-3 bottom-3 z-40 flex items-stretch justify-around rounded-[var(--radius-panel)] px-1 lg:hidden"
      style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
    >
      {NAV_ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium',
              'transition-colors duration-[120ms]',
              active
                ? 'text-[var(--accent)] [text-shadow:0_0_10px_var(--accent-glow)]'
                : 'text-[var(--text-3)]',
            )}
          >
            {active ? (
              <span
                className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)]"
                aria-hidden
              />
            ) : null}
            <item.icon className="size-[17px]" />
            {t.nav[item.label]}
          </Link>
        );
      })}

      <button
        type="button"
        onClick={toggleCommand}
        className="flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium text-[var(--text-3)]"
      >
        <Search className="size-[17px]" />
        {t.common.search}
      </button>
    </nav>
  );
}
