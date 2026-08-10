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
  client ??= createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return client;
}

/**
 * Every channel is private, so Realtime has to be handed the user's access
 * token before `subscribe()` — otherwise the RLS policies on
 * `realtime.messages` see an anonymous caller and the join is rejected.
 *
 * Safe to call repeatedly; it re-reads the current session each time, which is
 * what keeps the socket authorised across a token refresh.
 */
export async function authorizeRealtime(): Promise<void> {
  await getSupabaseBrowserClient().realtime.setAuth();
}
