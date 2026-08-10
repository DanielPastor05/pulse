import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

import { publicEnv, serverEnv } from '@/lib/env';

/** Request-scoped Supabase client that reads/writes the auth cookies. */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — the middleware refreshes the
          // session cookies instead, so this is safe to ignore.
        }
      },
    },
  });
}

let adminClient: SupabaseClient | undefined;

/** Service-role client. Server only — bypasses RLS, never send to the browser. */
export function createSupabaseAdminClient(): SupabaseClient {
  adminClient ??= createServerClient(publicEnv.supabaseUrl, serverEnv.serviceRoleKey, {
    cookies: { getAll: () => [], setAll: () => undefined },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}
