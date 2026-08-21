/**
 * Environment access.
 *
 * Values are read lazily so a missing variable fails at the point of use with a
 * readable message instead of exploding at import time (which would break
 * `next build` and produce an opaque stack trace).
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable "${name}". Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

export const publicEnv = {
  get supabaseUrl() {
    return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  /**
   * Optional. Nothing is built from it any more — invite links derive their
   * origin from the request — so it is only an extra entry in the CSRF
   * allow-list, for when the app is reached through a domain the request URL
   * does not reflect. Demanding it would turn a missing nice-to-have into
   * every mutation failing.
   */
  get appUrl(): string | undefined {
    return process.env.NEXT_PUBLIC_APP_URL || undefined;
  },
  /** Absent is a valid setup: push is simply off. */
  get vapidPublicKey(): string | undefined {
    return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined;
  },
} as const;

export const serverEnv = {
  get serviceRoleKey() {
    return required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);
  },
  get tenorApiKey() {
    return process.env.TENOR_API_KEY ?? '';
  },
  /**
   * Lo que Vercel manda en `Authorization` al disparar una tarea programada.
   *
   * Sin él la limpieza no corre, y es a propósito: un endpoint que borra
   * ficheros y no comprueba quién llama es peor que no tener limpieza. Que sea
   * opcional permite además que un clon del repositorio arranque sin ella.
   */
  get cronSecret(): string | undefined {
    return process.env.CRON_SECRET || undefined;
  },
  get vapidPrivateKey(): string | undefined {
    return process.env.VAPID_PRIVATE_KEY || undefined;
  },
  /** web-push demands a contact; a mailto is what the spec expects. */
  get vapidSubject() {
    return process.env.VAPID_SUBJECT || 'mailto:admin@localhost';
  },
  /**
   * Cloudflare TURN. Server-only, and it matters that it is: the API token
   * mints relay credentials against the account's quota, so shipping it to the
   * browser would hand that quota to anyone who opened devtools.
   */
  get turnTokenId(): string | undefined {
    return process.env.CLOUDFLARE_TURN_TOKEN_ID || undefined;
  },
  get turnApiToken(): string | undefined {
    return process.env.CLOUDFLARE_TURN_API_TOKEN || undefined;
  },
  /**
   * Workers AI, para los embeddings de la búsqueda. También server-only, y por
   * el mismo motivo que el de TURN: el token gasta la cuota de neuronas de la
   * cuenta, así que en el navegador sería la cuota de cualquiera.
   *
   * Opcionales los dos: sin ellos la rama vectorial se apaga y la búsqueda
   * sigue funcionando sólo con la léxica, que es degradarse, no romperse. Un
   * clon del repositorio arranca sin tener cuenta de Cloudflare.
   */
  get cloudflareAccountId(): string | undefined {
    return process.env.CLOUDFLARE_ACCOUNT_ID || undefined;
  },
  get cloudflareAiToken(): string | undefined {
    return process.env.CLOUDFLARE_AI_TOKEN || undefined;
  },
} as const;

export const isProduction = process.env.NODE_ENV === 'production';
