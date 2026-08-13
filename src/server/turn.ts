import { serverEnv } from '@/lib/env';

/**
 * Short-lived TURN credentials from Cloudflare.
 *
 * Cloudflare does not issue a fixed username and password: the API token mints
 * credentials that expire. That token is a **secret** — it can spend the
 * account's relay quota — so it never leaves the server, and the browser asks
 * this app for credentials instead of talking to Cloudflare itself.
 *
 * Without a relay a call fails wherever symmetric NAT blocks a direct path,
 * which is most mobile networks. STUN alone only covers the easy cases, so the
 * public STUN list below is a floor, not a substitute.
 */

const ENDPOINT = 'https://rtc.live.cloudflare.com/v1/turn/keys';

/** Long enough for a call to start and outlive a short reconnection. */
const TTL_SECONDS = 2 * 60 * 60;

const PUBLIC_STUN: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

export function turnIsConfigured(): boolean {
  return Boolean(serverEnv.turnTokenId && serverEnv.turnApiToken);
}

/**
 * Returns ICE servers for one call. Never throws: a call with STUN only still
 * connects for plenty of people, and failing the request would take away the
 * ones that would have worked.
 */
export async function issueIceServers(): Promise<{ iceServers: RTCIceServer[]; relay: boolean }> {
  const tokenId = serverEnv.turnTokenId;
  const apiToken = serverEnv.turnApiToken;
  if (!tokenId || !apiToken) return { iceServers: PUBLIC_STUN, relay: false };

  try {
    const response = await fetch(`${ENDPOINT}/${tokenId}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ttl: TTL_SECONDS }),
      // Cloudflare being slow must not hold up the call any longer than this.
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('[turn] cloudflare refused', response.status, await response.text());
      return { iceServers: PUBLIC_STUN, relay: false };
    }

    const payload = (await response.json()) as { iceServers?: RTCIceServer | RTCIceServer[] };
    const servers = payload.iceServers;
    if (!servers) return { iceServers: PUBLIC_STUN, relay: false };

    const list = Array.isArray(servers) ? servers : [servers];
    const relay = list.some((server) =>
      (Array.isArray(server.urls) ? server.urls : [server.urls]).some((url) =>
        String(url).startsWith('turn'),
      ),
    );

    // The public STUN entries stay as a fallback path, not a replacement.
    return { iceServers: [...list, ...PUBLIC_STUN], relay };
  } catch (error) {
    console.error('[turn] could not mint credentials', error);
    return { iceServers: PUBLIC_STUN, relay: false };
  }
}
