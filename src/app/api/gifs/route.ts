import { z } from 'zod';

import { serverEnv } from '@/lib/env';
import { requireUser } from '@/server/auth';
import { json, parseQuery, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

const querySchema = z.object({ q: z.string().max(80).default('') });

export type GifResult = {
  id: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
  description: string;
};

type TenorResponse = {
  results?: Array<{
    id: string;
    content_description?: string;
    media_formats?: Record<string, { url: string; dims?: [number, number] }>;
  }>;
};

/**
 * Tenor proxy — keeps the API key server-side.
 * Returns `configured: false` so the picker can render a helpful empty state
 * rather than an error when no key is set.
 */
export const GET = route(async (request) => {
  const user = await requireUser();
  await rateLimit(`gifs:${user.id}`, rateLimits.search);

  if (!serverEnv.tenorApiKey) return json({ configured: false, gifs: [] as GifResult[] });

  const { q } = parseQuery(request, querySchema);
  const endpoint = q.trim() ? 'search' : 'featured';
  const url = new URL(`https://tenor.googleapis.com/v2/${endpoint}`);
  url.searchParams.set('key', serverEnv.tenorApiKey);
  url.searchParams.set('limit', '24');
  url.searchParams.set('media_filter', 'tinygif,gif');
  url.searchParams.set('client_key', 'pulse');
  if (q.trim()) url.searchParams.set('q', q.trim());

  const response = await fetch(url, { next: { revalidate: 60 } });
  if (!response.ok) return json({ configured: true, gifs: [] as GifResult[] });

  const payload = (await response.json()) as TenorResponse;

  const gifs: GifResult[] = (payload.results ?? []).flatMap((result) => {
    const full = result.media_formats?.gif;
    const preview = result.media_formats?.tinygif ?? full;
    if (!full || !preview) return [];
    return [
      {
        id: result.id,
        url: full.url,
        previewUrl: preview.url,
        width: full.dims?.[0] ?? 320,
        height: full.dims?.[1] ?? 240,
        description: result.content_description ?? 'GIF',
      },
    ];
  });

  return json({ configured: true, gifs });
});
