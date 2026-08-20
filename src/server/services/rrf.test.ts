import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fuse, RRF_K } from './rrf.ts';

test('un documento que sólo aparece en una rama sigue puntuando', () => {
  // El caso que justifica toda la función: una paráfrasis la encuentra el
  // vector y nunca el léxico. Si la fusión exigiera estar en las dos, la
  // búsqueda híbrida no encontraría nada que la léxica no encontrara ya.
  const salida = fuse([['a'], ['b']]);

  assert.deepEqual(
    salida.map((row) => row.id).sort(),
    ['a', 'b'],
    'ninguna rama puede vetar a la otra',
  );
});

test('coincidir en las dos ramas puntúa más que ser primero en una sola', () => {
  // «b» es segundo en las dos; «a» es primero en una y no está en la otra.
  const salida = fuse([
    ['a', 'b'],
    ['c', 'b'],
  ]);

  assert.equal(salida[0]?.id, 'b', 'el acuerdo entre ramas debe ganar');
  assert.equal(salida[0]?.rank, 2 / (RRF_K + 2));
});

test('las posiciones empiezan en uno', () => {
  // Con base cero el primero valdría 1/k en vez de 1/(k+1) y toda la escala se
  // desplazaría — invisible en el orden y visible en el cursor, que compara
  // puntuaciones entre páginas.
  const [primero] = fuse([['a']]);
  assert.equal(primero?.rank, 1 / (RRF_K + 1));
});

test('no le importa la escala de cada rama, sólo el orden', () => {
  // Es la propiedad por la que se elige RRF: `ts_rank` da ~0,06 y la distancia
  // coseno ~0,2, y no hay forma honesta de sumarlas. Aquí sólo entran listas.
  const izquierda = fuse([
    ['x', 'y', 'z'],
    ['z', 'y', 'x'],
  ]);
  const derecha = fuse([
    ['z', 'y', 'x'],
    ['x', 'y', 'z'],
  ]);

  assert.deepEqual(
    izquierda.map((r) => r.rank),
    derecha.map((r) => r.rank),
    'dar la vuelta a las ramas no cambia las puntuaciones',
  );
});

test('el orden es total, para que el cursor no se salte ni repita', () => {
  // Tres ids con exactamente la misma puntuación: sin desempate el orden lo
  // decidiría el motor y la paginación caminaría una lista distinta de la que
  // se ve en pantalla. Es el mismo fallo que el historial ya arregló rompiendo
  // empates de `createdAt` con el id.
  const salida = fuse([['a'], ['b'], ['c']]);

  assert.deepEqual(salida.map((r) => r.rank), [
    1 / (RRF_K + 1),
    1 / (RRF_K + 1),
    1 / (RRF_K + 1),
  ]);
  assert.deepEqual(salida.map((r) => r.id), ['c', 'b', 'a'], 'empate roto por id, descendente');
});

test('una lista vacía no rompe la fusión', () => {
  assert.deepEqual(fuse([[], []]), []);
  assert.deepEqual(
    fuse([[], ['a']]).map((r) => r.id),
    ['a'],
  );
});
