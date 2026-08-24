import assert from 'node:assert/strict';
import test from 'node:test';

import { mapearGiphy, type GiphyResponse } from './giphy.ts';

/*
 * Lo que estas pruebas cubren: la traducción de una respuesta a lo que el
 * selector necesita. Es la parte que se rompe al tocar el código, y corre sin
 * red ni clave.
 *
 * La forma de la respuesta **está comprobada contra la API real** (24/08/2026):
 * los formatos que el mapeo prefiere existen, `alt_text` viene, y se mapearon
 * cinco de cinco resultados en los dos catálogos. Antes de esa comprobación
 * estas mismas pruebas pasaban igual sobre una forma sacada de la documentación
 * — pasar no era lo mismo que ser cierto, y eso estaba dicho aquí.
 */

/** Una respuesta con la forma real, recortada a lo que se usa. */
const RESPUESTA: GiphyResponse = {
  data: [
    {
      id: 'abc123',
      title: 'gato asustado',
      alt_text: 'un gato saltando de un pepino',
      images: {
        fixed_width_small: { url: 'https://media.giphy.test/abc-100.gif', width: '100', height: '75' },
        fixed_width: { url: 'https://media.giphy.test/abc-200.gif', width: '200', height: '150' },
        downsized_medium: { url: 'https://media.giphy.test/abc-med.gif', width: '480', height: '360' },
        original: { url: 'https://media.giphy.test/abc.gif', width: '480', height: '360' },
      },
    },
  ],
};

test('coge la miniatura ligera para la rejilla y la mediana para mandar', () => {
  const [primero] = mapearGiphy(RESPUESTA, 'gif');

  assert.equal(primero?.previewUrl, 'https://media.giphy.test/abc-100.gif');
  assert.equal(primero?.url, 'https://media.giphy.test/abc-med.gif');
});

test('prefiere alt_text al título', () => {
  // `alt_text` es lo que GIPHY escribe pensando en un lector de pantalla, y el
  // título suele ser el nombre del fichero con guiones.
  const [primero] = mapearGiphy(RESPUESTA, 'gif');
  assert.equal(primero?.description, 'un gato saltando de un pepino');
});

test('cae al título cuando no hay alt_text', () => {
  const sinAlt = { data: [{ ...RESPUESTA.data![0]!, alt_text: undefined }] };
  assert.equal(mapearGiphy(sinAlt, 'gif')[0]?.description, 'gato asustado');
});

test('y a una descripción genérica cuando no hay ninguno de los dos', () => {
  const pelado = { data: [{ ...RESPUESTA.data![0]!, alt_text: undefined, title: undefined }] };
  assert.equal(mapearGiphy(pelado, 'gif')[0]?.description, 'GIF');
  assert.equal(mapearGiphy(pelado, 'sticker')[0]?.description, 'Sticker');
});

test('las medidas llegan como cadenas y salen como números', () => {
  const [primero] = mapearGiphy(RESPUESTA, 'gif');
  assert.equal(primero?.width, 480);
  assert.equal(primero?.height, 360);
});

test('una medida ilegible no se convierte en NaN', () => {
  // Un `NaN` en un `width` rompe la rejilla sin decir por qué.
  const raro: GiphyResponse = {
    data: [
      {
        id: 'x',
        images: { original: { url: 'https://media.giphy.test/x.gif', width: '', height: 'ocho' } },
      },
    ],
  };
  const [primero] = mapearGiphy(raro, 'gif');
  assert.equal(primero?.width, 320);
  assert.equal(primero?.height, 240);
});

test('se apaña con sólo el formato original', () => {
  // Es el caso corriente en stickers poco populares: GIPHY no promete todas las
  // variantes, y una celda vacía es peor que una imagen grande.
  const escueto: GiphyResponse = {
    data: [{ id: 'y', images: { original: { url: 'https://media.giphy.test/y.gif' } } }],
  };
  const [primero] = mapearGiphy(escueto, 'sticker');
  assert.equal(primero?.url, 'https://media.giphy.test/y.gif');
  assert.equal(primero?.previewUrl, 'https://media.giphy.test/y.gif');
});

test('un resultado sin ninguna URL se descarta en vez de colarse vacío', () => {
  /*
   * Un `<img src="">` no queda en blanco: el navegador pide **la página actual**
   * otra vez y la pinta como si fuera una imagen. Es de los fallos que más
   * despistan, así que aquí no entra.
   */
  const roto: GiphyResponse = {
    data: [
      { id: 'z', images: { original: { width: '10', height: '10' } } },
      { id: 'bueno', images: { original: { url: 'https://media.giphy.test/bueno.gif' } } },
    ],
  };
  const salida = mapearGiphy(roto, 'gif');

  assert.equal(salida.length, 1);
  assert.equal(salida[0]?.id, 'bueno');
});

test('un resultado sin id tampoco: es la clave de la rejilla', () => {
  const sinId: GiphyResponse = {
    data: [{ images: { original: { url: 'https://media.giphy.test/a.gif' } } }],
  };
  assert.deepEqual(mapearGiphy(sinId, 'gif'), []);
});

test('una respuesta vacía o rara no revienta', () => {
  assert.deepEqual(mapearGiphy({}, 'gif'), []);
  assert.deepEqual(mapearGiphy({ data: [] }, 'gif'), []);
});
