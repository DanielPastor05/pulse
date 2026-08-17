import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * La parte del almacenamiento que esta aplicación usa, y nada más.
 *
 * Existe para poder sustituirlo en las pruebas. La capa de integración corre
 * contra un Postgres desechable sin Supabase, así que hasta ahora todo lo que
 * tocaba ficheros quedaba fuera de su alcance — y ahí salieron los dos últimos
 * fallos: un bucle que podía no terminar y un bucket que la limpieza se saltaba.
 * Un tipo estrecho es lo que permite escribir un doble en veinte líneas en vez
 * de fingir el cliente entero.
 */
export type StoredObject = { name: string; created_at?: string | null };

export type ObjectStore = {
  list(
    prefix: string,
    options: { limit: number },
  ): Promise<{ data: StoredObject[] | null; error: { message: string } | null }>;
  remove(paths: string[]): Promise<{ error: { message: string } | null }>;
};

export type Storage = { from(bucket: string): ObjectStore };

/** El de verdad. Clave de servicio: sólo servidor. */
export function adminStorage(): Storage {
  return createSupabaseAdminClient().storage;
}
