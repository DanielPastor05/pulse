import assert from 'node:assert/strict';
import test from 'node:test';

import { debeEnviarEscritura, ESPERA_ESCRITURA_MS } from './typing-throttle.ts';

/*
 * Un reloj realista, y no un 1000 cualquiera.
 *
 * La primera versión de estas pruebas usaba `ahora = 1000` con `ultimoEnvio = 0`
 * y esperaba que saliera: con esos números la resta da 1000, por debajo de la
 * espera de 2000, así que fallaban. El código estaba bien — lo que no valía era
 * el reloj de juguete, porque `Date.now()` vale ~1,7e12 y contra un cero
 * cualquier resta supera la espera.
 *
 * Es la misma trampa que las cargas hostiles que no cabían en el campo: unos
 * valores de prueba que no se parecen a los de verdad miden otra cosa.
 */
const AHORA = 1_787_500_000_000;

test('la primera pulsación sale al momento', () => {
  // `ultimoEnvio` arranca en 0, así que la primera nunca debe esperar: si lo
  // hiciera, el indicador tardaría dos segundos en aparecer siempre.
  assert.equal(debeEnviarEscritura(AHORA, 0, true), true);
});

test('dentro de la espera no sale nada', () => {
  assert.equal(debeEnviarEscritura(AHORA + 1_000, AHORA, true), false);
});

test('justo al cumplirse la espera, sí', () => {
  assert.equal(debeEnviarEscritura(AHORA + ESPERA_ESCRITURA_MS, AHORA, true), true);
});

test('sin canal no sale, y ese es el arreglo entero', () => {
  /*
   * Suscribirse tarda ~350 ms medidos contra producción. Quien escribe dentro
   * de esa ventana no tiene canal, y lo que importa no es que el paquete no
   * salga —no puede— sino que **no se gaste el turno**. Antes se gastaba, y el
   * indicador no aparecía hasta dos segundos más tarde.
   */
  assert.equal(debeEnviarEscritura(AHORA, 0, false), false);
});

test('en cuanto hay canal, la siguiente pulsación sale sin esperar', () => {
  // La consecuencia de lo anterior, y la que arregla lo que se notaba usando la
  // aplicación: como el intento sin canal no tocó el reloj, `ultimoEnvio` sigue
  // en 0 y la primera pulsación con canal —350 ms después— sale entera.
  const ultimoEnvio = 0; // no lo movió el intento fallido
  assert.equal(debeEnviarEscritura(AHORA + 350, ultimoEnvio, true), true);
});
