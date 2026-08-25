import assert from 'node:assert/strict';
import test from 'node:test';

import { vistaPreviaDe } from './message-preview.ts';

const GIF = 'https://media2.giphy.com/media/v1.abc/giphy.gif';

test('un GIF suelto se reconoce como imagen', () => {
  const vista = vistaPreviaDe(`![un gato saltando](${GIF})`);

  assert.equal(vista.tipo, 'imagen');
  assert.equal(vista.tipo === 'imagen' && vista.url, GIF);
  assert.equal(vista.tipo === 'imagen' && vista.alt, 'un gato saltando');
  assert.equal(vista.tipo === 'imagen' && vista.sticker, false);
});

test('un sticker se distingue por su título', () => {
  const vista = vistaPreviaDe(`![un pato](${GIF} "sticker")`);
  assert.equal(vista.tipo === 'imagen' && vista.sticker, true);
});

test('el texto normal se queda como está', () => {
  const vista = vistaPreviaDe('mira lo que ha dicho Kenji');
  assert.deepEqual(vista, { tipo: 'texto', texto: 'mira lo que ha dicho Kenji' });
});

test('texto con una imagen dentro sigue siendo texto', () => {
  /*
   * El caso que obliga a anclar la expresión a principio y fin.
   *
   * «mira esto ![x](u) y esto otro» es un mensaje escrito por una persona que
   * además lleva una imagen. Resumirlo como «una imagen» tiraría lo que dijo,
   * que es justo lo que se quiere enseñar en una cita.
   */
  const vista = vistaPreviaDe(`mira esto ![x](${GIF}) y esto otro`);
  assert.equal(vista.tipo, 'texto');
});

test('una imagen precedida de texto tampoco cuenta', () => {
  assert.equal(vistaPreviaDe(`toma: ![x](${GIF})`).tipo, 'texto');
});

test('los espacios alrededor no despistan', () => {
  // El redactor inserta el markdown en el cursor, así que suele venir con
  // saltos de línea alrededor.
  assert.equal(vistaPreviaDe(`\n  ![x](${GIF})  \n`).tipo, 'imagen');
});

test('un alt vacío no rompe nada', () => {
  const vista = vistaPreviaDe(`![](${GIF})`);
  assert.equal(vista.tipo === 'imagen' && vista.alt, '');
});

test('un enlace normal no es una imagen', () => {
  // Sin la admiración inicial es un enlace, y un enlace sí se lee como texto.
  assert.equal(vistaPreviaDe(`[un gato](${GIF})`).tipo, 'texto');
});

test('markdown a medio escribir no se confunde con una imagen', () => {
  for (const roto of ['![sin cerrar](', '![](', '!()', '![alt]', '![a](b) ![c](d)']) {
    assert.equal(vistaPreviaDe(roto).tipo, 'texto', `«${roto}» no es una imagen`);
  }
});
