import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import { recordVital } from '@/server/metrics';

export const dynamic = 'force-dynamic';

/**
 * Los nombres que emite `next/web-vitals`, en lista cerrada.
 *
 * Cerrada y no `z.string()`: esto lo llama el navegador, así que cualquiera
 * puede mandar lo que quiera. Sin la lista, una cadena arbitraria se
 * convertiría en su propia serie y el panel se llenaría de métricas inventadas
 * hasta esconder las cuatro que importan.
 */
const bodySchema = z.object({
  metric: z.enum(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']),
  value: z.number().finite().min(0).max(600_000),
  rating: z.enum(['good', 'needs-improvement', 'poor']),
  path: z.string().max(120),
});

/**
 * Recoge una medida del navegador.
 *
 * Tras `requireUser` y con límite: el servidor mide su propia latencia por su
 * cuenta, pero lo que tarda una pantalla en pintarse sólo lo sabe quien la
 * mira. Es la única señal que no puede venir de dentro.
 */
export const POST = route(async (request) => {
  const user = await requireUser();
  await rateLimit(`vitals:${user.id}`, rateLimits.mutate);

  const input = await parseBody(request, bodySchema);
  await recordVital(input);

  // 202 y no 200: se acepta y se guarda fuera del camino, y a quien lo manda
  // —un `sendBeacon` que ni mira la respuesta— no le importa el cuerpo.
  return json({ ok: true }, { status: 202 });
});
