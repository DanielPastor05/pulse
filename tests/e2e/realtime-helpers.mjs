/**
 * Subscribing to a private channel the way the browser does.
 *
 * Shared by the realtime suite and the load benchmark. Both need a client
 * carrying a real user session — anon alone cannot join, because RLS on
 * `realtime.messages` is what authorises the topic — and both need to wait for
 * an event with a deadline rather than hanging forever when nothing arrives.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

import { SUPABASE_URL } from './harness.mjs';

export const anonKey = readFileSync('.env', 'utf8')
  .split('\n')
  .find((line) => line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY'))
  .split('=')[1]
  .trim()
  .replace(/^["']|["']$/g, '');

/** A client carrying a real user session, like the browser has. */
export function clientFor(user) {
  const client = createClient(SUPABASE_URL, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  client.realtime.setAuth(user.session.access_token);
  return client;
}

/** Resolves with the payload, or null if nothing arrives before the deadline. */
export function waitFor(channel, event, ms = 15_000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    channel.on('broadcast', { event }, ({ payload }) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Resolves with the final subscription status, or 'TIMEOUT'. */
export function subscribed(channel, ms = 15_000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('TIMEOUT'), ms);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer);
        resolve(status);
      }
    });
  });
}

/**
 * Every broadcast on a conversation channel, timestamped on arrival.
 *
 * `waitFor` resolves once and stops listening, which is right for a single
 * assertion and useless for measuring: a benchmark needs every message that
 * lands, and needs to know *when* it landed. The map is keyed by `clientId`
 * because that is the only identifier the sender knows before the server
 * answers — matching on the server's id would mean the send had to complete
 * first, and the delivery being measured can beat it.
 */
export function collectArrivals(channel, event) {
  const arrivals = new Map();
  channel.on('broadcast', { event }, ({ payload }) => {
    // El servidor emite { message, clientId } en message.created.
    const key = payload?.clientId;
    if (key && !arrivals.has(key)) arrivals.set(key, performance.now());
  });
  return arrivals;
}
