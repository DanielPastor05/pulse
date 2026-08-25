import assert from 'node:assert/strict';
import test from 'node:test';

import { ALLOWED_MIME_TYPES, tipoBase } from './constants.ts';

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
