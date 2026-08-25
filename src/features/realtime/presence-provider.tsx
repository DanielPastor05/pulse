'use client';

import * as React from 'react';
import type { Presence } from '@prisma/client';

import { api } from '@/lib/api-client';
import { authorizeRealtime, getSupabaseBrowserClient } from '@/lib/supabase/client';
import { realtimeChannels } from '@/lib/realtime';
import { usePresenceStore } from '@/stores/presence-store';
import { useSession } from '@/components/providers/session-provider';

const HEARTBEAT_MS = 60_000;

type PresenceMeta = { userId: string; presence: Presence };

/**
 * Joins the global presence channel so every avatar in the app can show a live
 * dot, and writes a periodic heartbeat so `lastSeenAt` survives a hard close.
 */
export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const me = useSession();
  const setAll = usePresenceStore((state) => state.setAll);
  /**
   * Con la aplicación abierta se está en línea, y punto.
   *
   * Antes había detección de inactividad: sin ratón ni teclas durante tres
   * minutos, o con la pestaña oculta, pasabas a «ausente». Sonaba razonable y en
   * la práctica mentía — leer una conversación larga sin tocar nada te sacaba de
   * en línea, y quien te miraba creía que te habías ido. Se pidió justo así:
   * «que siempre que el usuario tenga la app abierta esté en línea a menos que
   * lo cambie».
   *
   * Lo que sí manda es la elección explícita. Quien se pone en «no molestar»,
   * «ausente» o «desconectado» desde el menú lo dice a propósito, y nada
   * automático debería contradecirle: ese estado se respeta mientras dure la
   * sesión.
   *
   * `lastSeenAt` sigue latiendo cada minuto, así que un cierre en seco se sigue
   * notando — la ausencia se deduce de dejar de latir, que es más fiable que un
   * temporizador de inactividad.
   */
  const presence: Presence = me.presence === 'ONLINE' ? 'ONLINE' : me.presence;

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
