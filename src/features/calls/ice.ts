'use client';

import { publicEnv } from '@/lib/env';

/**
 * ICE servers for the peer connections.
 *
 * STUN tells a peer what its public address looks like, which is enough when
 * both ends can be reached directly. TURN relays the media when they cannot —
 * symmetric NAT, most mobile carriers, plenty of home routers. Roughly a fifth
 * of connections need it, and without one those calls simply never connect
 * while everything else looks fine.
 *
 * Google's public STUN is fine as a default: it is a one-shot address lookup,
 * no media flows through it. TURN is not offered publicly by anyone, so it
 * stays configuration.
 */
const PUBLIC_STUN = ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'];

export function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: PUBLIC_STUN }];

  const { turnUrl, turnUsername, turnCredential } = publicEnv;
  if (turnUrl && turnUsername && turnCredential) {
    servers.push({ urls: turnUrl, username: turnUsername, credential: turnCredential });
  }

  return servers;
}

/** True when a relay is configured; the UI warns when it is not. */
export function hasTurn(): boolean {
  return Boolean(publicEnv.turnUrl && publicEnv.turnUsername && publicEnv.turnCredential);
}
