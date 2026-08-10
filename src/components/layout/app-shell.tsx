'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useUiStore } from '@/stores/ui-store';
import { useUserChannel } from '@/features/realtime/use-user-channel';
import { PresenceProvider } from '@/features/realtime/presence-provider';
import { CommandPalette } from '@/features/search/components/command-palette';
import { ShortcutsDialog } from '@/components/layout/shortcuts-dialog';
import { MobileTabBar, TopDock } from '@/components/layout/top-dock';

/**
 * The persistent chrome around every signed-in page: ambient background,
 * navigation, global realtime subscriptions and the command palette.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { setCommandOpen, setShortcutsOpen, setMobileNavOpen } = useUiStore();

  useUserChannel();

  useKeyboardShortcuts([
    { key: 'k', meta: true, allowInInput: true, handler: () => setCommandOpen(true) },
    { key: '/', meta: false, handler: () => setCommandOpen(true) },
    { key: '?', shift: true, handler: () => setShortcutsOpen(true) },
    { key: 'escape', allowInInput: true, handler: () => setMobileNavOpen(false) },
    { key: ',', meta: true, allowInInput: true, handler: () => router.push('/settings') },
  ]);

  return (
    <PresenceProvider>

      {/* Dock on top, content columns below — the reference layout. */}
      <div className="flex h-dvh flex-col gap-4 overflow-hidden p-3 md:p-4 lg:gap-6 lg:p-6">
        <div className="hidden lg:block">
          <TopDock />
        </div>
        <div className="relative flex min-h-0 flex-1 gap-4 lg:gap-6">{children}</div>
      </div>

      <MobileTabBar />
      <CommandPalette />
      <ShortcutsDialog />
    </PresenceProvider>
  );
}
