import { STORAGE_BUCKETS } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { log } from '@/server/logger';
import { adminStorage, type Storage } from '@/server/storage';

/** Una subida sin mensaje puede seguir en curso; por debajo de esto no se toca. */
const ORPHAN_AGE_MS = 24 * 60 * 60_000;

/** Lo que `list` devuelve como mucho de una vez. */
const PAGE = 1000;

/**
 * La ruta dentro del bucket, o `null` si la URL no apunta a nuestro almacenamiento.
 *
 * Los avatares no tienen columna de ruta como los adjuntos: lo que se guarda es
 * la URL pública entera, y puede perfectamente ser externa — la foto que trae
 * una cuenta de Google al entrar por OAuth. De ahí que esto devuelva `null` en
 * vez de adivinar: una URL que no reconocemos no protege ningún objeto porque no
 * hay ningún objeto que proteger.
 */
export function storagePath(url: string | null, bucket: string): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;

  // `getPublicUrl` puede colgar parámetros de transformación, y codifica el
  // nombre: un fichero con un espacio llega aquí como `%20` y en el bucket se
  // llama con el espacio.
  const tail = url.slice(at + marker.length).split(/[?#]/)[0] ?? '';
  try {
    return decodeURIComponent(tail);
  } catch {
    return null;
  }
}

/**
 * Borra de un bucket todo lo que no esté en `known` y ya no pueda estar en vuelo.
 *
 * La estructura es siempre `<userId>/<fichero>`, así que la raíz lista dueños y
 * cada dueño lista lo suyo.
 */
async function sweep(
  storage: Storage,
  bucket: string,
  known: Set<string>,
  cutoff: Date,
): Promise<number> {
  const { data: owners, error } = await storage.from(bucket).list('', { limit: PAGE });
  if (error) throw new Error(`${bucket}: ${error.message}`);

  const folders = owners ?? [];
  if (folders.length === PAGE) {
    // Un tope que trunca en silencio se lee igual que «no quedaba nada».
    log.warn('cron.cleanup_truncated', { bucket, limit: PAGE });
  }

  let removed = 0;

  for (const owner of folders) {
    const { data: objects, error: listError } = await storage
      .from(bucket)
      .list(owner.name, { limit: PAGE });
    if (listError) throw new Error(`${bucket}/${owner.name}: ${listError.message}`);

    const stale = (objects ?? [])
      .filter((object) => {
        if (known.has(`${owner.name}/${object.name}`)) return false;
        // La marca de creación es lo que evita borrar una subida en vuelo.
        const created = object.created_at ? new Date(object.created_at) : null;
        return created !== null && created < cutoff;
      })
      .map((object) => `${owner.name}/${object.name}`);

    if (stale.length > 0) {
      const { error: removeError } = await storage.from(bucket).remove(stale);
      if (removeError) throw new Error(`${bucket}: ${removeError.message}`);
      removed += stale.length;
    }
  }

  return removed;
}

/**
 * Limpieza periódica del almacenamiento, en los dos buckets.
 *
 * Se quedan sueltas por diseño tres cosas que nadie recoge:
 *
 * 1. Los adjuntos de mensajes que se borraron de verdad. El borrado normal es
 *    suave —el mensaje queda con `deletedAt` y su fichero sigue teniendo sentido
 *    si algún día se restaura— pero cuando una fila desaparece de verdad, por
 *    cascada al borrar una conversación, el objeto queda sin dueño.
 * 2. Ficheros que nunca llegaron a ser un mensaje. Elegir una foto pide la URL
 *    firmada y sube el fichero antes de enviar; cerrar la pestaña ahí deja el
 *    objeto arriba y ninguna fila apuntándolo. Pasa más de lo que parece.
 * 3. **Cada avatar anterior.** Cambiar de foto sube una nueva y reescribe
 *    `avatarUrl`; la de antes se queda arriba, pública en su URL, para siempre.
 *    Es el mismo problema que esta tarea vino a resolver, en el bucket de al
 *    lado, y durante un día estuvo aquí sin que nada lo dijera.
 *
 * Es idempotente por construcción: sólo borra lo que ya no debería existir, así
 * que ejecutarla dos veces seguidas no hace nada la segunda. Y dice cuánto borró
 * de cada sitio, porque una tarea que limpia en silencio no se distingue de una
 * que no se está ejecutando.
 */
export async function cleanupOrphans(storage: Storage = adminStorage()) {
  const cutoff = new Date(Date.now() - ORPHAN_AGE_MS);

  // Las rutas que la base de datos todavía reconoce como vivas. Todo lo que esté
  // arriba y no esté aquí sobra — es la única forma de encontrar los ficheros
  // que nunca tuvieron fila.
  //
  // Techo conocido: esto se trae todas las rutas a memoria. Con cientos de miles
  // de objetos habría que recorrer por dueño y consultar por lotes, o marcar el
  // objeto como reclamado al adjuntarlo y buscar por esa marca. A este volumen
  // no compensa la complejidad.
  const [attachments, users, conversations] = await Promise.all([
    prisma.attachment.findMany({ select: { path: true } }),
    prisma.user.findMany({ where: { avatarUrl: { not: null } }, select: { avatarUrl: true } }),
    prisma.conversation.findMany({
      where: { avatarUrl: { not: null } },
      select: { avatarUrl: true },
    }),
  ]);

  // Los dos, y no sólo los de usuario: el mismo selector de avatar pone la foto
  // de un grupo, así que mirando únicamente `User.avatarUrl` esta tarea borraría
  // el icono de cada grupo a las veinticuatro horas de ponerlo.
  const liveAvatars = new Set(
    [...users, ...conversations]
      .map((row) => storagePath(row.avatarUrl, STORAGE_BUCKETS.avatars))
      .filter((path): path is string => path !== null),
  );

  const removedAttachments = await sweep(
    storage,
    STORAGE_BUCKETS.attachments,
    new Set(attachments.map((row) => row.path)),
    cutoff,
  );
  const removedAvatars = await sweep(storage, STORAGE_BUCKETS.avatars, liveAvatars, cutoff);

  return {
    attachments: removedAttachments,
    avatars: removedAvatars,
    removed: removedAttachments + removedAvatars,
  };
}
