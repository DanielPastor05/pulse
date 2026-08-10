'use client';

import * as React from 'react';
import type { Presence } from '@prisma/client';

import { api } from '@/lib/api-client';
import { authorizeRealtime, getSupabaseBrowserClient } from '@/lib/supabase/client';
import { realtimeChannels } from '@/lib/realtime';
import { usePresenceStore } from '@/stores/presence-store';
import { useSession } from '@/components/providers/session-provider';

const IDLE_AFTER_MS = 3 * 60_000;
const HEARTBEAT_MS = 60_000;

type PresenceMeta = { userId: string; presence: Presence };

/**
 * Joins the global presence channel so every avatar in the app can show a live
 * dot, and writes a periodic heartbeat so `lastSeenAt` survives a hard close.
 */
export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const me = useSession();
  const setAll = usePresenceStore((state) => state.setAll);
  const [presence, setPresence] = React.useState<Presence>('ONLINE');

  // Idle detection: no input for three minutes, or the tab is hidden.
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const markActive = () => {
      clearTimeout(timer);
      setPresence(document.visibilityState === 'hidden' ? 'IDLE' : 'ONLINE');
      timer = setTimeout(() => setPresence('IDLE'), IDLE_AFTER_MS);
    };

    const events = ['pointerdown', 'keydown', 'visibilitychange', 'focus'] as const;
    for (const event of events) window.addEventListener(event, markActive, { passive: true });
    markActive();

    return () => {
      clearTimeout(timer);
      for (const event of events) window.removeEventListener(event, markActive);
    };
  }, []);

  React.useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(realtimeChannels.presence, {
      config: { presence: { key: me.id }, private: true },
    });

    const sync = () => {
      const state = channel.presenceState<PresenceMeta>();
      const next: Record<string, Presence> = {};
      for (const entries of Object.values(state)) {
        for (const entry of entries) next[entry.userId] = entry.presence;
      }
      setAll(next);
    };

    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync);

    void authorizeRealtime().then(() =>
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel.track({ userId: me.id, presence } satisfies PresenceMeta);
        }
      }),
    );

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [me.id, setAll, presence]);

  // Persist presence so it is correct for people who load the page later.
  React.useEffect(() => {
    const send = () => void api('/presence', { method: 'POST', body: { presence } }).catch(() => {});
    send();
    const interval = setInterval(send, HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [presence]);

  return <>{children}</>;
}
