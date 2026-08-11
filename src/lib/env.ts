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
} as const;

export const serverEnv = {
  get serviceRoleKey() {
    return required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);
  },
  get tenorApiKey() {
    return process.env.TENOR_API_KEY ?? '';
  },
} as const;

export const isProduction = process.env.NODE_ENV === 'production';
