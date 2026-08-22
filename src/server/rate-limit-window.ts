/**
 * La aritmética del contador deslizante, sin nada más.
 *
 * Vive aparte de `rate-limit.ts` para poder probarla: aquel importa Prisma y el
 * catálogo de errores por alias `@/`, y el ejecutor de pruebas unitarias —que
 * corre sin transpilar— no resuelve ese alias. Separar lo puro de lo que toca
 * la base es lo que convierte «se lee correcto» en «está comprobado».
 *
 * Es también donde vive la diferencia entre una ventana fija y una deslizante.
 * Ignorando `prevCount`, que es lo que hacía la versión anterior, una ráfaga a
 * caballo de un corte entra dos veces entera: medido, **1,88×** el límite.
 */

export type VentanaUso = {
  /** Peticiones en la ventana en curso, incluida la que se está decidiendo. */
  count: number;
  /** Cuántas hubo en la ventana inmediatamente anterior. */
  prevCount: number;
  /** Segundos transcurridos desde que empezó la ventana en curso. */
  elapsed: number;
};

/**
 * Cuánto se considera gastado, ponderando la ventana anterior por su solape.
 *
 * El solape se recorta a [0, 1] a propósito. Un desfase de reloj entre
 * instancias puede dar un transcurrido negativo o mayor que la ventana; sin el
 * recorte, el primero haría que la anterior contase **más** que entera, y el
 * segundo la restaría, abriendo cupo de la nada.
 */
export function estimarUso(fila: VentanaUso, ventanaSegundos: number): number {
  const solape = Math.max(0, Math.min(1, 1 - fila.elapsed / ventanaSegundos));
  return fila.prevCount * solape + fila.count;
}
