import { z } from 'zod';

import { serverEnv } from '@/lib/env';
import { json, parseQuery, route } from '@/server/http';
import { errors } from '@/server/errors';
import { percentiles, SAMPLE_RETENTION_DAYS } from '@/server/metrics';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  /** Ventana en minutos. Una hora por defecto, una semana como mucho. */
  minutes: z.coerce.number().int().min(1).max(60 * 24 * SAMPLE_RETENTION_DAYS).default(60),
});

/**
 * Percentiles de latencia por endpoint.
 *
 * Tras el mismo secreto compartido que la tarea programada, y no tras
 * `requireUser`: qué endpoints existen y cuánto tardan es información sobre la
 * forma de la aplicación, y no hay motivo para que la tenga cualquiera con una
 * cuenta. No hay roles de administrador en este proyecto, así que inventar uno
 * para esto sería añadir un concepto entero por una pantalla.
 */
export const GET = route(async (request) => {
  const expected = serverEnv.cronSecret;
  if (!expected) throw errors.badRequest('Metrics are not configured.');
  if (request.headers.get('authorization') !== `Bearer ${expected}`) {
    throw errors.unauthorized();
  }

  const { minutes } = parseQuery(request, querySchema);
  const routes = await percentiles(minutes);

  return json({
    windowMinutes: minutes,
    retentionDays: SAMPLE_RETENTION_DAYS,
    samples: routes.reduce((total, row) => total + row.samples, 0),
    routes,
  });
});
