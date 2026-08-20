'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { publicEnv } from '@/lib/env';

let client: SupabaseClient | undefined;

/**
 * Browser Supabase client (auth + realtime + storage).
 * Data reads/writes go through our own API routes so Prisma stays the single
 * source of truth for business rules; RLS is the second line of defence.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!client) {
    const created = createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
      realtime: { params: { eventsPerSecond: 20 } },
    });

    // El socket se queda con el JWT que llevaba al unirse a cada canal, y ese
    // token vive una hora. Sin volver a autorizar cuando se renueva, a los
    // sesenta minutos Supabase deja de aceptar los canales privados y **todo**
    // el tiempo real muere: avisos, bandeja y la llamada entrante. En silencio,
    // porque no hay petición que falle ni excepción que capturar — la pestaña
    // sigue pintando y respondiendo, sólo que ya no se entera de nada.
    //
    // Así se veía: una ventana abierta desde hacía rato no recibía la llamada,
    // mientras el que llamaba esperaba respuesta para siempre.
    created.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        void created.realtime.setAuth();
      }
    });

    // Y lo mismo al volver de segundo plano o de un corte de red.
    //
    // El navegador estrangula los temporizadores de una pestaña oculta, así que
    // el latido del socket se pierde y la conexión acaba cayéndose.
    // supabase-js reconecta y se vuelve a unir a los canales por su cuenta —
    // pero con el token que tuviera guardado, que a esas alturas puede haber
    // caducado, y entonces los canales privados se rechazan en silencio. Esto
    // sólo se asegura de que el token esté al día justo cuando va a reengancharse.
    if (typeof document !== 'undefined') {
      const refresh = () => {
        if (document.visibilityState === 'visible') void created.realtime.setAuth();
      };
      document.addEventListener('visibilitychange', refresh);
      window.addEventListener('online', refresh);
    }

    client = created;
  }
  return client;
}

/**
 * Every channel is private, so Realtime has to be handed the user's access
 * token before `subscribe()` — otherwise the RLS policies on
 * `realtime.messages` see an anonymous caller and the join is rejected.
 *
 * Sólo cubre el momento de suscribirse. Mantenerlo autorizado después es cosa
 * del oyente de `getSupabaseBrowserClient`, que es donde estaba el fallo.
 */
export async function authorizeRealtime(): Promise<void> {
  await getSupabaseBrowserClient().realtime.setAuth();
}

/**
 * Un canal privado que no engancha deja la aplicación viva pero sorda, y hasta
 * ahora eso no se veía por ningún sitio: `subscribe()` se llamaba sin mirar el
 * resultado. Se reintenta una vez volviendo a autorizar, que es lo que arregla
 * el caso real, y si sigue sin ir al menos queda dicho.
 */
export function subscribeWithRetry(
  channel: ReturnType<SupabaseClient['channel']>,
  label: string,
): void {
  // Los reintentos no se agotan para siempre: se cuentan por racha y la racha
  // se pone a cero en cuanto el canal engancha. Un contador de una sola vida
  // deja el canal muerto tras la primera reconexión fallida del día, que es
  // justo el caso que se quiere sobrevivir.
  let attempts = 0;

  const join = () => {
    channel.subscribe((status, error) => {
      if (status === 'SUBSCRIBED') {
        attempts = 0;
        return;
      }
      if (status !== 'CHANNEL_ERROR' && status !== 'TIMED_OUT') return;

      if (attempts >= 4) {
        console.error(`[realtime] ${label} no pudo suscribirse: ${status}`, error);
        return;
      }

      // Espera creciente: reintentar en bucle contra un servicio caído sólo
      // añade ruido al problema.
      const wait = 500 * 2 ** attempts;
      attempts += 1;
      setTimeout(() => void authorizeRealtime().then(join), wait);
    });
  };

  join();
}
