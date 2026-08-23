import { z } from 'zod';

import { serverEnv } from '@/lib/env';
import { requireUser } from '@/server/auth';
import { json, parseQuery, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Dos catálogos, un proveedor.
 *
 * Tenor sirve los stickers por los mismos endpoints que los GIF, cambiando un
 * filtro. Eso es lo que hace que añadirlos cueste un parámetro en vez de una
 * integración: misma clave, mismo proxy, mismo límite de peticiones.
 */
const querySchema = z.object({
  q: z.string().max(80).default(''),
  kind: z.enum(['gif', 'sticker']).default('gif'),
});

export type GifKind = 'gif' | 'sticker';

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
 * Qué formatos se piden y cuáles se leen, por catálogo.
 *
 * Los stickers se piden **transparentes**: un sticker sobre fondo blanco es un
 * GIF con peor recorte. Se dejan los formatos opacos como reserva porque Tenor
 * no garantiza que todos los resultados traigan la variante transparente, y una
 * rejilla con huecos es peor que un sticker con fondo.
 */
const CATALOGOS = {
  gif: {
    searchfilter: undefined,
    media_filter: 'tinygif,gif',
    completo: ['gif'],
    vistaPrevia: ['tinygif', 'gif'],
  },
  sticker: {
    searchfilter: 'sticker',
    media_filter: 'tinygif_transparent,gif_transparent,tinygif,gif',
    completo: ['gif_transparent', 'gif'],
    vistaPrevia: ['tinygif_transparent', 'gif_transparent', 'tinygif', 'gif'],
  },
} as const satisfies Record<GifKind, unknown>;

/** El primer formato disponible de la lista de preferencia. */
function primerFormato(
  formatos: Record<string, { url: string; dims?: [number, number] }> | undefined,
  preferencia: readonly string[],
) {
  for (const nombre of preferencia) {
    const formato = formatos?.[nombre];
    if (formato?.url) return formato;
  }
  return undefined;
}

/**
 * Tenor proxy — keeps the API key server-side.
 * Returns `configured: false` so the picker can render a helpful empty state
 * rather than an error when no key is set.
 */
export const GET = route(async (request) => {
  const user = await requireUser();
  await rateLimit(`gifs:${user.id}`, rateLimits.search);

  /*
   * Se valida antes de mirar la configuración, y no al revés.
   *
   * Estaba al revés y se vio al probarlo: sin clave de Tenor, `?kind=pegatina`
   * devolvía 200 en vez de 400, porque el corte por «no configurado» pasaba por
   * delante de `parseQuery` y la validación no llegaba a ejecutarse. Es la misma
   * forma que AUDIT-04 —una comprobación que parece estar y a la que no se
   * llega— y hace que la respuesta a una petición mal formada dependa de una
   * variable de entorno, que es lo último de lo que debería depender.
   */
  const { q, kind } = parseQuery(request, querySchema);
  const catalogo = CATALOGOS[kind];

  if (!serverEnv.tenorApiKey) return json({ configured: false, gifs: [] as GifResult[] });

  const endpoint = q.trim() ? 'search' : 'featured';
  const url = new URL(`https://tenor.googleapis.com/v2/${endpoint}`);
  url.searchParams.set('key', serverEnv.tenorApiKey);
  url.searchParams.set('limit', '24');
  url.searchParams.set('media_filter', catalogo.media_filter);
  url.searchParams.set('client_key', 'pulse');
  if (catalogo.searchfilter) url.searchParams.set('searchfilter', catalogo.searchfilter);
  if (q.trim()) url.searchParams.set('q', q.trim());

  const response = await fetch(url, { next: { revalidate: 60 } });
  if (!response.ok) return json({ configured: true, gifs: [] as GifResult[] });

  const payload = (await response.json()) as TenorResponse;

  const gifs: GifResult[] = (payload.results ?? []).flatMap((result) => {
    const full = primerFormato(result.media_formats, catalogo.completo);
    const preview = primerFormato(result.media_formats, catalogo.vistaPrevia) ?? full;
    if (!full || !preview) return [];
    return [
      {
        id: result.id,
        url: full.url,
        previewUrl: preview.url,
        width: full.dims?.[0] ?? 320,
        height: full.dims?.[1] ?? 240,
        description: result.content_description ?? (kind === 'sticker' ? 'Sticker' : 'GIF'),
      },
    ];
  });

  return json({ configured: true, gifs });
});
