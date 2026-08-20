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
import { CallOverlay } from '@/features/calls/components/call-overlay';
import { CallProvider } from '@/features/calls/call-provider';
import { WebVitals } from '@/features/telemetry/web-vitals';
import { useOutboxFlush } from '@/features/messages/use-outbox-flush';

/**
 * The persistent chrome around every signed-in page: ambient background,
 * navigation, global realtime subscriptions and the command palette.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { setCommandOpen, setShortcutsOpen, setMobileNavOpen } = useUiStore();

  useUserChannel();
  // Aquí y no en la conversación: lo escrito sin cobertura tiene que salir al
  // volver la red, se esté mirando ese chat o no.
  useOutboxFlush();

  useKeyboardShortcuts([
    { key: 'k', meta: true, allowInInput: true, handler: () => setCommandOpen(true) },
    { key: '/', meta: false, handler: () => setCommandOpen(true) },
    { key: '?', shift: true, handler: () => setShortcutsOpen(true) },
    { key: 'escape', allowInInput: true, handler: () => setMobileNavOpen(false) },
    { key: ',', meta: true, allowInInput: true, handler: () => router.push('/settings') },
  ]);

  return (
    <PresenceProvider>
      {/* Envuelve todo: la cabecera de la conversación también pide llamar, y
          tiene que ser la misma llamada que la que pinta el overlay. */}
      <CallProvider>
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
        {/* Here rather than inside a conversation: a call has to survive
            navigating away from the chat it started in, and an incoming one has
            to appear wherever you happen to be. */}
        <CallOverlay />
        {/* No pinta nada: manda al servidor lo que sólo sabe el navegador. */}
        <WebVitals />
      </CallProvider>
    </PresenceProvider>
  );
}
