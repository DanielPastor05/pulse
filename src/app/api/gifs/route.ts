import { z } from 'zod';

import { serverEnv } from '@/lib/env';
import { requireUser } from '@/server/auth';
import { mapearGiphy, type GifKind, type GifResult, type GiphyResponse } from '@/server/giphy';
import { json, parseQuery, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

export type { GifKind, GifResult } from '@/server/giphy';

const querySchema = z.object({
  q: z.string().max(80).default(''),
  kind: z.enum(['gif', 'sticker']).default('gif'),
  /** Para que buscar «gato» encuentre lo que busca quien escribe en español. */
  lang: z.enum(['en', 'es']).default('en'),
});

/**
 * Dos catálogos, dos endpoints.
 *
 * GIPHY los separa de verdad —`/gifs` y `/stickers`— en vez de esconder los
 * stickers tras un filtro, y los suyos vienen con fondo transparente, que es lo
 * que los distingue de un GIF cuadrado cualquiera.
 */
const RUTAS: Record<GifKind, string> = { gif: 'gifs', sticker: 'stickers' };

/**
 * GIPHY proxy — keeps the API key server-side.
 *
 * Devuelve `configured: false` en vez de un error cuando no hay clave, para que
 * el selector pinte un vacío que lo explica. Es el estado por defecto de un
 * clon del repositorio y no debería parecer una avería.
 */
export const GET = route(async (request) => {
  const user = await requireUser();
  await rateLimit(`gifs:${user.id}`, rateLimits.search);

  /*
   * Se valida antes de mirar la configuración, y no al revés.
   *
   * Estaba al revés y se vio al probarlo: sin clave, `?kind=pegatina` devolvía
   * 200 en vez de 400, porque el corte por «no configurado» pasaba por delante
   * de `parseQuery` y la validación no llegaba a ejecutarse. Es la misma forma
   * que AUDIT-04 —una comprobación que parece estar y a la que no se llega— y
   * hace que la respuesta a una petición mal formada dependa de una variable de
   * entorno, que es lo último de lo que debería depender.
   */
  const { q, kind, lang } = parseQuery(request, querySchema);

  if (!serverEnv.giphyApiKey) return json({ configured: false, gifs: [] as GifResult[] });

  const termino = q.trim();
  const endpoint = termino ? 'search' : 'trending';
  const url = new URL(`https://api.giphy.com/v1/${RUTAS[kind]}/${endpoint}`);
  url.searchParams.set('api_key', serverEnv.giphyApiKey);
  url.searchParams.set('limit', '24');
  // `g` y no `pg-13`: esto sale en una conversación ajena sin que quien la lee
  // haya pedido nada, y el techo más bajo es el único que no da sorpresas.
  url.searchParams.set('rating', 'g');
  url.searchParams.set('lang', lang);
  if (termino) url.searchParams.set('q', termino);

  const response = await fetch(url, { next: { revalidate: 60 } });
  if (!response.ok) return json({ configured: true, gifs: [] as GifResult[] });

  const payload = (await response.json()) as GiphyResponse;
  return json({ configured: true, gifs: mapearGiphy(payload, kind) });
});
