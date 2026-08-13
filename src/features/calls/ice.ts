'use client';

import { api } from '@/lib/api-client';

/**
 * ICE servers for the peer connections, fetched per call.
 *
 * They are not configuration on this side any more: Cloudflare issues
 * short-lived credentials, and the token that mints them stays on the server
 * because it spends the account's relay quota. The browser asks this app.
 *
 * STUN tells a peer what its public address looks like, which is enough when
 * both ends can be reached directly. TURN relays the media when they cannot —
 * symmetric NAT, most mobile carriers, plenty of home routers.
 */

const FALLBACK: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

export type IceConfig = {
  iceServers: RTCIceServer[];
  /** False when no relay is available, which the UI says out loud. */
  relay: boolean;
};

export async function fetchIceConfig(): Promise<IceConfig> {
  try {
    return await api<IceConfig>('/calls/ice');
  } catch (error) {
    // A failure here still leaves a call that works for anyone reachable
    // directly, which beats refusing to start one.
    console.error('[call] could not fetch ICE servers', error);
    return { iceServers: FALLBACK, relay: false };
  }
}
