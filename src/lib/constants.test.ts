import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { ALLOWED_MIME_TYPES, FONDOS, tipoBase } from './constants.ts';

/*
 * El fallo que cazó la primera persona que grabó una nota de voz:
 *
 *     voice-1787614371801.webm — That file type is not supported.
 *
 * `audio/webm` llevaba en la lista desde el principio. Lo que no coincidía era
 * la cadena: `MediaRecorder` devuelve el códec pegado al tipo y la comprobación
 * compara por igualdad exacta.
 */

test('quita el códec que pega MediaRecorder', () => {
  assert.equal(tipoBase('audio/webm;codecs=opus'), 'audio/webm');
  assert.equal(tipoBase('video/webm;codecs=vp8,opus'), 'video/webm');
});

test('un tipo limpio se queda igual', () => {
  assert.equal(tipoBase('image/png'), 'image/png');
});

test('tolera espacios y mayúsculas', () => {
  // `Content-Type` viene de cabeceras y de APIs del navegador; ninguna de las
  // dos promete minúsculas ni ausencia de espacios.
  assert.equal(tipoBase('  Audio/WEBM ; codecs=opus'), 'audio/webm');
});

test('lo que graba el navegador pasa la lista', () => {
  // La prueba que de verdad importa: el tipo real, normalizado, contra la lista
  // real. Sin esto, las tres de arriba pueden pasar y las notas de voz seguir
  // rechazándose porque falte la entrada.
  for (const grabado of ['audio/webm;codecs=opus', 'audio/mp4', 'video/webm;codecs=vp9']) {
    assert.ok(
      ALLOWED_MIME_TYPES.includes(tipoBase(grabado) as (typeof ALLOWED_MIME_TYPES)[number]),
      `${grabado} debería poder subirse`,
    );
  }
});

test('y lo que no está sigue sin estar', () => {
  // El control: si `tipoBase` devolviera algo demasiado corto —«audio», por
  // ejemplo— la lista dejaría de filtrar nada.
  assert.equal(ALLOWED_MIME_TYPES.includes(tipoBase('image/svg+xml') as never), false);
  assert.equal(ALLOWED_MIME_TYPES.includes(tipoBase('application/x-msdownload') as never), false);
});

/*
 * Los fondos de conversación viven en tres sitios que no se importan entre sí:
 * la lista aquí, el dibujo en `globals.css` y el nombre visible en los
 * diccionarios.
 *
 * Los nombres los comprueba el compilador, porque el selector indexa
 * `backgroundNames` con el tipo de la lista y falta una clave se ve al momento.
 * El dibujo no lo comprueba nadie, y es justo el que se puede olvidar sin que
 * nada se queje: un identificador sin regla deja una muestra en blanco en el
 * selector, que se puede pulsar y no hace nada. Pasa tipos, pasa lint y pasa el
 * build. Es la misma forma de fallo que ya apareció en este proyecto con un
 * módulo `'use client'` que el servidor no podía leer.
 */
const CSS = readFileSync(join(import.meta.dirname, '../app/globals.css'), 'utf8');

test('cada fondo del catálogo tiene su dibujo en el CSS', () => {
  // `ninguno` es la ausencia de fondo, no un fondo: no lleva regla, y el
  // selector no le pone el atributo.
  const conDibujo = FONDOS.filter((fondo) => fondo !== 'ninguno');
  assert.ok(conDibujo.length > 0, 'el catálogo no puede quedarse vacío');

  const sinRegla = conDibujo.filter((fondo) => !CSS.includes(`[data-fondo='${fondo}']`));
  assert.deepEqual(sinRegla, [], 'fondos en la lista que nadie sabe pintar');
});

test('y cada dibujo del CSS está en el catálogo', () => {
  // El otro sentido, que es el control: si la comprobación de arriba pasara
  // porque el CSS lo contiene todo, ésta fallaría. Una regla huérfana es CSS
  // que nadie puede elegir.
  const enCss = [...CSS.matchAll(/\[data-fondo='([a-z]+)'\]/g)].map((coincidencia) => coincidencia[1]);
  assert.ok(enCss.length > 0, 'la expresión no encuentra ninguna regla; mira si cambió el formato');

  const huerfanas = enCss.filter((fondo) => !FONDOS.includes(fondo as (typeof FONDOS)[number]));
  assert.deepEqual(huerfanas, [], 'dibujos que no están en la lista');
});
