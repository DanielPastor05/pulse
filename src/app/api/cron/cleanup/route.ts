import { serverEnv } from '@/lib/env';
import { json, route } from '@/server/http';
import { errors } from '@/server/errors';
import { describeError, log } from '@/server/logger';
import { cleanupOrphans } from '@/server/services/cleanup.service';

export const dynamic = 'force-dynamic';

/**
 * Dispara la limpieza del almacenamiento. La lógica vive en el servicio, que es
 * donde las pruebas de integración pueden alcanzarla con un doble.
 */
export const GET = route(async (request) => {
  // Vercel manda `Authorization: Bearer <CRON_SECRET>`. Sin esta comprobación
  // sería un endpoint de borrado que cualquiera puede disparar.
  const expected = serverEnv.cronSecret;
  if (!expected) throw errors.badRequest('Scheduled cleanup is not configured.');
  if (request.headers.get('authorization') !== `Bearer ${expected}`) {
    throw errors.unauthorized();
  }

  const startedAt = performance.now();

  try {
    const result = await cleanupOrphans();
    const ms = Math.round(performance.now() - startedAt);
    log.info('cron.cleanup', { ...result, ms });
    return json({ ...result, ms });
  } catch (error) {
    log.error('cron.cleanup_failed', describeError(error));
    throw errors.badRequest('Cleanup did not finish.');
  }
});
