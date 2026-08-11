import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Fetches Open Graph metadata for a URL a user typed.
 *
 * This is the one place in the app where the server makes a request to an
 * address chosen by somebody else, which is the definition of SSRF. Everything
 * below exists to stop that request reaching somewhere it should not:
 *
 *  - the hostname is resolved and every resulting address is checked, because
 *    a name like `evil.test` can point at `127.0.0.1` and the string tells you
 *    nothing;
 *  - each redirect hop is resolved and checked again, since only the first URL
 *    is under our nose;
 *  - the read is capped in time and in bytes, so a slow drip or an endless
 *    stream cannot tie up a request.
 *
 * Cloud metadata endpoints (169.254.169.254) are the prize an attacker is
 * usually after here; they fall out of the link-local rule below.
 */

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 5_000;
const MAX_BYTES = 512 * 1024;

/** Longer than any real URL, and short enough to stay inside a btree index. */
export const MAX_URL_LENGTH = 512;

export type LinkPreviewData = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
};

function ipv4IsPrivate(address: string): boolean {
  const [a, b] = address.split('.').map(Number);
  if (a === undefined || b === undefined) return true;

  if (a === 0) return true; // "this network"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast and reserved
  return false;
}

function ipv6IsPrivate(address: string): boolean {
  // Strip any zone index (`fe80::1%eth0`).
  const value = address.toLowerCase().split('%')[0] ?? '';

  if (value === '::' || value === '::1') return true;

  // IPv4 wearing an IPv6 costume: judge the address inside.
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return ipv4IsPrivate(mapped[1]);

  const head = parseInt(value.split(':')[0] || '0', 16);
  if ((head & 0xfe00) === 0xfc00) return true; // unique local
  if ((head & 0xffc0) === 0xfe80) return true; // link local
  return false;
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return ipv4IsPrivate(address);
  if (version === 6) return ipv6IsPrivate(address);
  return true; // unparseable means we do not trust it
}

/** Rejects unless every address the hostname resolves to is public. */
async function hostnameIsSafe(hostname: string): Promise<boolean> {
  // A bare IP in the URL never reaches DNS, so judge it directly.
  if (isIP(hostname)) return !isPrivateAddress(hostname);

  try {
    const addresses = await lookup(hostname, { all: true });
    if (addresses.length === 0) return false;
    return addresses.every((entry) => !isPrivateAddress(entry.address));
  } catch {
    return false;
  }
}

function unescapeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&');
}

function clamp(value: string | null, max: number): string | null {
  if (!value) return null;
  const trimmed = unescapeHtml(value).replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/**
 * Pulls one meta value out of raw HTML.
 *
 * A regex rather than a DOM parser on purpose: this only ever reads a handful
 * of well-known tags from the first chunk of a document, and pulling in a
 * parser to do it would mean running far more attacker-controlled markup
 * through far more code.
 */
function metaContent(html: string, names: string[]): string | null {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `<meta[^>]+(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*>`,
      'i',
    );
    const tag = html.match(pattern)?.[0];
    if (!tag) continue;
    const content = tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1];
    if (content?.trim()) return content;
  }
  return null;
}

/** Reads at most MAX_BYTES so a huge or endless body cannot exhaust memory. */
async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';

  const decoder = new TextDecoder();
  let text = '';
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      text += decoder.decode(value, { stream: true });
      if (total >= MAX_BYTES) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  return text;
}

/**
 * Returns metadata, or null when the URL is unreachable, disallowed, or simply
 * has nothing worth showing. Never throws: a bad link must not break a message.
 */
export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreviewData | null> {
  if (rawUrl.length > MAX_URL_LENGTH) return null;

  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    return null;
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== 'http:' && current.protocol !== 'https:') return null;
    if (!(await hostnameIsSafe(current.hostname))) return null;

    let response: Response;
    try {
      response = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          // Some sites serve their OG tags only to crawlers.
          'user-agent': 'Mozilla/5.0 (compatible; PulseBot/1.0; +https://github.com/)',
          accept: 'text/html,application/xhtml+xml',
        },
      });
    } catch {
      return null;
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return null;
      try {
        current = new URL(location, current); // relative redirects are legal
      } catch {
        return null;
      }
      continue; // and round again, so the new host is checked too
    }

    if (!response.ok) return null;
    if (!(response.headers.get('content-type') ?? '').includes('html')) return null;

    const html = await readCapped(response);
    return parseLinkPreviewHtml(html, current);
  }

  return null; // too many redirects
}

/**
 * Turns fetched HTML into card data. Split out from the fetch so it can be
 * tested without a network, which matters because the interesting cases are
 * about what the markup says, not about how it arrived.
 */
export function parseLinkPreviewHtml(html: string, base: URL | string): LinkPreviewData | null {
  const data: LinkPreviewData = {
    title:
      clamp(metaContent(html, ['og:title', 'twitter:title']), 300) ??
      clamp(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null, 300),
    description: clamp(
      metaContent(html, ['og:description', 'twitter:description', 'description']),
      600,
    ),
    imageUrl: metaContent(html, ['og:image', 'twitter:image']),
    siteName: clamp(metaContent(html, ['og:site_name']), 120),
  };

  // Resolve a relative image against the page, and refuse anything that is not
  // plain http(s) — the URL ends up in an <img src>.
  if (data.imageUrl) {
    try {
      const image = new URL(unescapeHtml(data.imageUrl), base);
      data.imageUrl =
        image.protocol === 'http:' || image.protocol === 'https:' ? image.toString() : null;
    } catch {
      data.imageUrl = null;
    }
    if (data.imageUrl && data.imageUrl.length > MAX_URL_LENGTH * 4) data.imageUrl = null;
  }

  // A card with no title and no description is just a smaller version of the
  // link that is already there.
  if (!data.title && !data.description) return null;
  return data;
}

/** The first http(s) URL in a message, ignoring anything inside code. */
export function firstUrl(content: string): string | null {
  const withoutCode = content.replace(/(```[\s\S]*?```|`[^`\n]*`)/g, ' ');
  const match = withoutCode.match(/https?:\/\/[^\s<>"')\]]+/i);
  if (!match) return null;

  // Trailing punctuation is almost always sentence punctuation, not the URL.
  const url = match[0].replace(/[.,;:!?]+$/, '');
  return url.length <= MAX_URL_LENGTH ? url : null;
}
