import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BARRIDO_ESCRITURA_MS,
  ESPERA_ESCRITURA_MS,
  VIDA_ESCRITURA_MS,
  canalPuedeEnviar,
  debeEnviarEscritura,
  haCaducado,
  mereceLaPenaReenviar,
} from './typing-throttle.ts';

/*
 * Un reloj realista, y no un 1000 cualquiera.
 *
 * La primera versión de estas pruebas usaba `ahora = 1000` con `ultimoEnvio = 0`
 * y esperaba que saliera: con esos números la resta da 1000, por debajo de la
 * espera, así que fallaban. El código estaba bien — lo que no valía era el reloj
 * de juguete, porque `Date.now()` vale ~1,7e12 y contra un cero cualquier resta
 * supera la espera.
 *
 * Es la misma trampa que las cargas hostiles que no cabían en el campo: unos
 * valores de prueba que no se parecen a los de verdad miden otra cosa.
 */
const AHORA = 1_787_500_000_000;

/** El peor viaje medido contra producción, en `npm run bench:typing`. */
const VIAJE_PEOR_CASO_MS = 168;

// ---------------------------------------------------------------------------
// Enviar
// ---------------------------------------------------------------------------

test('la primera pulsación sale al momento', () => {
  // `ultimoEnvio` arranca en 0, así que la primera nunca debe esperar: si lo
  // hiciera, el indicador tardaría un segundo en aparecer siempre.
  assert.equal(debeEnviarEscritura(AHORA, 0, true), true);
});

test('dentro de la espera no sale nada', () => {
  assert.equal(debeEnviarEscritura(AHORA + ESPERA_ESCRITURA_MS - 1, AHORA, true), false);
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
  // Como el intento sin canal no tocó el reloj, `ultimoEnvio` sigue en 0 y la
  // primera pulsación con canal —350 ms después— sale entera.
  assert.equal(debeEnviarEscritura(AHORA + 350, 0, true), true);
});

// ---------------------------------------------------------------------------
// Caducar
// ---------------------------------------------------------------------------

test('una entrada recién llegada no caduca', () => {
  assert.equal(haCaducado(AHORA, AHORA), false);
});

test('caduca al cumplirse su vida', () => {
  assert.equal(haCaducado(AHORA + VIDA_ESCRITURA_MS, AHORA), true);
  assert.equal(haCaducado(AHORA + VIDA_ESCRITURA_MS - 1, AHORA), false);
});

// ---------------------------------------------------------------------------
// Existir no es poder enviar
// ---------------------------------------------------------------------------

test('sólo un canal unido puede enviar', () => {
  assert.equal(canalPuedeEnviar({ state: 'joined' }), true);
});

test('un canal recién creado, no', () => {
  /*
   * Éste es el fallo entero.
   *
   * La referencia al canal se asigna al crearlo, así que «¿hay canal?» decía que
   * sí desde el primer render. Con eso, la ruta de «guárdalo para cuando se
   * pueda» no se activaba nunca y el envío se hacía sobre un canal a medio unir,
   * donde supabase-js cae solo a la API REST — sin error, por otro camino y con
   * una deprecación encima.
   */
  for (const state of ['closed', 'joining', 'errored', 'leaving']) {
    assert.equal(canalPuedeEnviar({ state }), false, `«${state}» no debería poder enviar`);
  }
});

test('ni uno que no está', () => {
  assert.equal(canalPuedeEnviar(null), false);
  assert.equal(canalPuedeEnviar(undefined), false);
  assert.equal(canalPuedeEnviar({}), false);
});

// ---------------------------------------------------------------------------
// La relación entre los tres, que es lo que de verdad hay que proteger
// ---------------------------------------------------------------------------

test('el aviso no parpadea mientras alguien sigue escribiendo', () => {
  /*
   * La propiedad, no el ejemplo.
   *
   * Entre paquete y paquete no llega nada que refresque la entrada, así que si
   * la vida no supera al acelerador **más el viaje**, el aviso se apaga y se
   * vuelve a encender cada segundo. Bajar sólo uno de los dos números lo
   * provoca, y es la razón de que vivan en el mismo fichero.
   */
  const alLlegarElSiguiente = ESPERA_ESCRITURA_MS + VIAJE_PEOR_CASO_MS;

  assert.equal(
    haCaducado(AHORA + alLlegarElSiguiente, AHORA),
    false,
    `la vida (${VIDA_ESCRITURA_MS} ms) no aguanta hasta el siguiente paquete ` +
      `(${alLlegarElSiguiente} ms): el aviso parpadearía`,
  );
});

test('la cola al dejar de escribir se mantiene por debajo de tres segundos', () => {
  /*
   * Lo que se nota usando la aplicación, con número.
   *
   * Peor caso: el último paquete salió justo al empezar la espera, así que la
   * persona escribe hasta `ESPERA` después; la entrada caduca `VIDA` más tarde;
   * y el barrido tarda hasta `BARRIDO` en enterarse.
   *
   * Con los valores anteriores (2000 + 4000 + 1000) daba 7 s de peor caso y
   * entre 4 y 5 s de caso corriente, que es exactamente lo que se veía.
   */
  const peorCola = ESPERA_ESCRITURA_MS + VIDA_ESCRITURA_MS + BARRIDO_ESCRITURA_MS;

  assert.ok(peorCola <= 3_750, `la cola en el peor caso es de ${peorCola} ms`);
});

// ---------------------------------------------------------------------------
// Reenviar la pulsación que se quedó sin canal
// ---------------------------------------------------------------------------

test('una pulsación reciente sí se reenvía al llegar el canal', () => {
  assert.equal(mereceLaPenaReenviar(AHORA + 350, AHORA), true);
});

test('una vieja no: describiría un presente que ya pasó', () => {
  assert.equal(mereceLaPenaReenviar(AHORA + ESPERA_ESCRITURA_MS, AHORA), false);
});
