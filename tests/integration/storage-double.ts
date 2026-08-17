import type { Storage, StoredObject } from '@/server/storage';

/**
 * Un almacenamiento en memoria con la forma que tiene el de verdad.
 *
 * Existe porque la capa de integración corre contra un Postgres desechable sin
 * Supabase, así que todo lo que tocaba ficheros —borrar la cuenta, la limpieza
 * programada— quedaba fuera del alcance de las pruebas. Ahí salieron los dos
 * fallos que esto viene a cerrar.
 *
 * Lo que imita y por qué importa:
 *
 * - **`list('')` devuelve carpetas, no rutas.** Es lo que hace el de verdad, y
 *   la limpieza depende de ello para recorrer por dueño. Un doble que devolviera
 *   rutas completas dejaría pasar una limpieza rota.
 * - **`remove` puede devolver sin error sin borrar nada.** Eso es exactamente lo
 *   que hace Supabase cuando una política deniega el borrado, y es la forma del
 *   fallo que colgaba el barrido. Sin poder reproducirlo, la comprobación que lo
 *   detecta no se puede probar.
 */
export type StorageDouble = Storage & {
  /** Rutas que quedan en un bucket, ordenadas. */
  paths(bucket: string): string[];
  /** A partir de aquí `remove` dice que sí y no borra: el permiso denegado que Supabase no reporta. */
  refuseRemovesSilently(): void;
};

/** `{ bucket: { 'ruta/fichero': fechaISO } }` */
export type StorageSeed = Record<string, Record<string, string>>;

export function storageDouble(seed: StorageSeed = {}): StorageDouble {
  const buckets = new Map<string, Map<string, string>>();
  for (const [bucket, files] of Object.entries(seed)) {
    buckets.set(bucket, new Map(Object.entries(files)));
  }

  let refuseRemove = false;

  function objectsIn(bucket: string) {
    let map = buckets.get(bucket);
    if (!map) {
      map = new Map();
      buckets.set(bucket, map);
    }
    return map;
  }

  return {
    paths(bucket) {
      return [...objectsIn(bucket).keys()].sort();
    },

    refuseRemovesSilently() {
      refuseRemove = true;
    },

    from(bucket) {
      const objects = objectsIn(bucket);

      return {
        async list(prefix, options) {
          // Los hijos inmediatos del prefijo: ficheros con su fecha, carpetas
          // sin ella. Un `Map` porque varios objetos comparten carpeta y la
          // carpeta sale una sola vez.
          const children = new Map<string, string | null>();

          for (const [path, createdAt] of objects) {
            if (prefix === '') {
              const slash = path.indexOf('/');
              if (slash === -1) children.set(path, createdAt);
              else children.set(path.slice(0, slash), null);
            } else if (path.startsWith(`${prefix}/`)) {
              children.set(path.slice(prefix.length + 1), createdAt);
            }
          }

          // Ordenado por nombre, como el de verdad: sin eso la paginación de
          // cualquier prueba dependería del orden de inserción.
          const data: StoredObject[] = [...children]
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .slice(0, options.limit)
            .map(([name, created_at]) => ({ name, created_at }));

          return { data, error: null };
        },

        async remove(paths) {
          if (refuseRemove) return { error: null };
          for (const path of paths) objects.delete(path);
          return { error: null };
        },
      };
    },
  };
}

/** Una fecha ISO a N horas del presente hacia atrás. */
export function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60_000).toISOString();
}
