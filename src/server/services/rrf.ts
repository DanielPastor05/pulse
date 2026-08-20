/**
 * Reciprocal Rank Fusion.
 *
 * Combina varias listas ordenadas sumando `1 / (k + posición)` de cada una. Lo
 * que la hace la elección correcta aquí es lo que **no** necesita: no compara
 * las puntuaciones de las ramas entre sí. `ts_rank` devuelve algo del orden de
 * 0,06 y la distancia coseno algo del orden de 0,2, y no significan lo mismo ni
 * están en la misma escala — normalizarlas para poder sumarlas exige elegir un
 * rango, y ese rango cambia con cada consulta. RRF sólo mira **posiciones**, que
 * es lo único que las dos ramas expresan igual.
 *
 * Un documento que sale primero en una rama y no aparece en la otra sigue
 * puntuando: eso es justo lo que se busca aquí, porque una paráfrasis sólo la
 * encuentra el vector y un identificador sólo lo encuentra el léxico.
 */

/**
 * La constante del artículo original (Cormack et al., 2009).
 *
 * Amortigua las primeras posiciones: sin ella, el primero de una lista valdría
 * el doble que el segundo, y una rama segura de sí misma arrastraría la fusión
 * entera. Con k=60 la diferencia entre el puesto 1 y el 2 es del 2%, así que
 * hace falta coincidencia entre ramas para subir de verdad.
 */
export const RRF_K = 60;

export type Ranked = { id: string; rank: number };

/**
 * Fusiona listas ya ordenadas y devuelve `{ id, rank }` con `rank` como
 * puntuación fusionada, descendente.
 *
 * La forma de salida es la misma que ya producía la rama léxica, para que todo
 * lo que hay debajo —hidratación, orden, cursor— siga sirviendo sin cambios.
 *
 * Los empates se rompen por id descendente. No es cosmética: la paginación usa
 * `(puntuación, id)` como cursor y necesita un orden total, el mismo motivo por
 * el que el historial rompe empates de `createdAt` con el id.
 */
export function fuse(lists: string[][], k: number = RRF_K): Ranked[] {
  const scores = new Map<string, number>();

  for (const list of lists) {
    for (const [index, id] of list.entries()) {
      // `index + 1`: la posición es 1 para el primero. Con base 0 el primero
      // valdría 1/k y el segundo 1/(k+1), que desplaza toda la escala.
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1));
    }
  }

  return [...scores]
    .map(([id, rank]) => ({ id, rank }))
    .sort((a, b) => (b.rank !== a.rank ? b.rank - a.rank : (a.id < b.id ? 1 : -1)));
}
