import { STORAGE_BUCKETS } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { serverEnv } from '@/lib/env';
import { json, route } from '@/server/http';
import { errors } from '@/server/errors';
import { describeError, log } from '@/server/logger';

export const dynamic = 'force-dynamic';

/** Una subida sin mensaje puede seguir en curso; por debajo de esto no se toca. */
const ORPHAN_AGE_MS = 24 * 60 * 60_000;

/**
 * Limpieza periódica del almacenamiento.
 *
 * Dos cosas se quedan sueltas por diseño y nadie las recoge:
 *
 * 1. Los adjuntos de mensajes que se borraron de verdad. El borrado normal es
 *    suave —el mensaje queda con `deletedAt` y su fichero sigue teniendo sentido
 *    si algún día se restaura— pero cuando una fila desaparece de verdad, por
 *    cascada al borrar una conversación, el objeto queda sin dueño.
 * 2. Ficheros que nunca llegaron a ser un mensaje. Elegir una foto pide la URL
 *    firmada y sube el fichero antes de enviar; cerrar la pestaña ahí deja el
 *    objeto arriba y ninguna fila apuntándolo. Pasa más de lo que parece.
 *
 * Es idempotente por construcción: sólo borra lo que ya no debería existir, así
 * que ejecutarla dos veces seguidas no hace nada la segunda. Y dice cuánto
 * borró, porque una tarea que limpia en silencio no se distingue de una que no
 * se está ejecutando.
 */
export const GET = route(async (request) => {
  // Vercel manda `Authorization: Bearer <CRON_SECRET>`. Sin esta comprobación
  // sería un endpoint de borrado que cualquiera puede disparar.
  const expected = serverEnv.cronSecret;
  if (!expected) throw errors.badRequest('Scheduled cleanup is not configured.');
  if (request.headers.get('authorization') !== `Bearer ${expected}`) {
    throw errors.unauthorized();
  }

  const admin = createSupabaseAdminClient();
  const startedAt = performance.now();
  let removed = 0;
  const cutoff = new Date(Date.now() - ORPHAN_AGE_MS);

  try {
    // Las rutas que la base de datos todavía reconoce como vivas. Todo lo que
    // esté arriba y no esté aquí sobra — es la única forma de encontrar los
    // ficheros que nunca tuvieron fila.
    //
    // Techo conocido: esto se trae todas las rutas a memoria. Con cientos de
    // miles de adjuntos habría que recorrer por dueño y consultar por lotes, o
    // marcar el objeto como reclamado al adjuntarlo y buscar por esa marca. A
    // este volumen no compensa la complejidad.
    const known = new Set(
      (await prisma.attachment.findMany({ select: { path: true } })).map((row) => row.path),
    );

    const { data: owners, error: ownersError } = await admin.storage
      .from(STORAGE_BUCKETS.attachments)
      .list('', { limit: 1000 });
    if (ownersError) throw new Error(ownersError.message);

    for (const owner of owners ?? []) {
      const { data: objects, error } = await admin.storage
        .from(STORAGE_BUCKETS.attachments)
        .list(owner.name, { limit: 1000 });
      if (error) throw new Error(error.message);

      const stale = (objects ?? [])
        .filter((object) => {
          const path = `${owner.name}/${object.name}`;
          if (known.has(path)) return false;
          // La marca de creación es lo que evita borrar una subida en vuelo.
          const created = object.created_at ? new Date(object.created_at) : null;
          return created !== null && created < cutoff;
        })
        .map((object) => `${owner.name}/${object.name}`);

      if (stale.length > 0) {
        const { error: removeError } = await admin.storage
          .from(STORAGE_BUCKETS.attachments)
          .remove(stale);
        if (removeError) throw new Error(removeError.message);
        removed += stale.length;
      }
    }
  } catch (error) {
    log.error('cron.cleanup_failed', { removed, ...describeError(error) });
    throw errors.badRequest('Cleanup did not finish.');
  }

  const ms = Math.round(performance.now() - startedAt);
  log.info('cron.cleanup', { removed, ms });
  return json({ removed, ms });
});
