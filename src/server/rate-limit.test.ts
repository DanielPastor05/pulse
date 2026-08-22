import assert from 'node:assert/strict';
import { test } from 'node:test';

import { estimarUso } from './rate-limit-window.ts';

/**
 * La aritmética del contador deslizante, sin base de datos de por medio.
 *
 * El resto del limitador es una sentencia de SQL y se comprueba ejecutándola
 * (`npm run bench:rate`). Lo que sí se puede probar aquí es la decisión: dada
 * la ventana anterior, la actual y cuánto ha transcurrido, ¿cuánto se considera
 * gastado?
 *
 * Vale la pena aislarlo porque es donde vive el error de la ventana fija. Con
 * `prevCount` ignorado —que es lo que hacía antes— el segundo tramo de una
 * ráfaga a caballo del corte entra entero, y el pico real dobla el límite.
 * Medido antes de cambiarlo: **1,88×**.
 */

const VENTANA = 10;

test('recién abierta la ventana, sólo cuenta lo de ahora', () => {
  // Sin nada anterior, el uso es el contador tal cual.
  assert.equal(estimarUso({ count: 5, prevCount: 0, elapsed: 0 }, VENTANA), 5);
});

test('justo al cruzar el corte, la ventana anterior cuenta casi entera', () => {
  // Éste es el caso que rompía. Antes: 1. Ahora: 25 + 1 = 26, y con límite 25
  // la petición se rechaza en vez de abrir un segundo cupo.
  const uso = estimarUso({ count: 1, prevCount: 25, elapsed: 0 }, VENTANA);
  assert.equal(uso, 26);
  assert.ok(uso > 25, 'con límite 25 esto tiene que rechazarse');
});

test('a mitad de ventana, la anterior pesa la mitad', () => {
  assert.equal(estimarUso({ count: 10, prevCount: 20, elapsed: 5 }, VENTANA), 20);
});

test('al final de la ventana, la anterior ya no pesa', () => {
  assert.equal(estimarUso({ count: 7, prevCount: 100, elapsed: 10 }, VENTANA), 7);
});

test('un transcurrido mayor que la ventana no resta', () => {
  // Un reloj que se adelante no debe producir un solape negativo, que restaría
  // del uso y abriría cupo de la nada.
  assert.equal(estimarUso({ count: 7, prevCount: 100, elapsed: 999 }, VENTANA), 7);
});

test('un transcurrido negativo no dispara el uso', () => {
  // El caso simétrico: desfase de reloj al revés. El solape se recorta a 1, así
  // que la anterior cuenta entera y nunca más que entera.
  assert.equal(estimarUso({ count: 1, prevCount: 10, elapsed: -5 }, VENTANA), 11);
});

test('el uso crece de forma monótona al llenarse la ventana', () => {
  // Propiedad, no ejemplo: a igualdad de todo lo demás, una petición más nunca
  // puede bajar el uso estimado.
  let anterior = -1;
  for (let count = 0; count <= 30; count += 1) {
    const uso = estimarUso({ count, prevCount: 12, elapsed: 3 }, VENTANA);
    assert.ok(uso > anterior, `count=${count} no aumentó el uso`);
    anterior = uso;
  }
});

test('y decrece de forma monótona al alejarse del corte', () => {
  // La otra mitad de la propiedad: cuanto más lejos queda la ventana anterior,
  // menos debe pesar. Si esto fallara, el limitador sería más estricto con el
  // tiempo en vez de menos.
  let anterior = Infinity;
  for (let elapsed = 0; elapsed <= VENTANA; elapsed += 0.5) {
    const uso = estimarUso({ count: 5, prevCount: 20, elapsed }, VENTANA);
    assert.ok(uso <= anterior, `elapsed=${elapsed} no redujo el uso`);
    anterior = uso;
  }
});
