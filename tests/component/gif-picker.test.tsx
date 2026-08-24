import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import * as React from 'react';
import { cleanup, fireEvent, screen } from '@testing-library/react';

import { GifPicker } from '@/features/messages/components/gif-picker';
import { MessageContent } from '@/features/messages/components/message-content';
import { queryKeys } from '@/lib/query-keys';
import type { GifKind, GifResult } from '@/app/api/gifs/route';
import { montar } from './harness.tsx';

/**
 * Dos catálogos en un selector, y la diferencia que hay que proteger.
 *
 * Un sticker no es un GIF con otro nombre: va transparente, cuadrado y sin
 * marco. Si la marca que los distingue se pierde entre el selector y el
 * renderizador, no falla nada — simplemente los stickers salen dentro de un
 * recuadro, que es exactamente lo que la transparencia venía a evitar. Por eso
 * las pruebas siguen la marca de punta a punta y no sólo la pestaña.
 */

after(cleanup);

const gif = (id: string): GifResult => ({
  id,
  url: `https://media.tenor.test/${id}.gif`,
  previewUrl: `https://media.tenor.test/${id}-tiny.gif`,
  width: 320,
  height: 240,
  description: `un ${id}`,
});

/**
 * Siembra los dos catálogos para la consulta vacía, que es la que se abre.
 *
 * La clave lleva el idioma además del catálogo, porque la búsqueda se manda
 * localizada. Cuando eso se añadió, estas semillas dejaron de casar y tres
 * pruebas se pusieron en rojo — que es exactamente lo que tenían que hacer:
 * la clave de caché es parte del contrato entre el componente y el servidor.
 */
const semillasDe = (lang: 'en' | 'es'): Array<[readonly unknown[], unknown]> => [
  [queryKeys.gifs('', `gif:${lang}`), { configured: true, gifs: [gif('gato')] }],
  [queryKeys.gifs('', `sticker:${lang}`), { configured: true, gifs: [gif('pato')] }],
];

function abrirSelector(onSelect: (gif: GifResult, kind: GifKind) => void = () => {}) {
  return montar(
    <GifPicker open onOpenChange={() => {}} onSelect={onSelect}>
      <button type="button">abrir</button>
    </GifPicker>,
    { semillas: semillasDe('en') },
  );
}

test('abre en GIFs y ofrece las dos pestañas', () => {
  abrirSelector();

  const gifs = screen.getByRole('tab', { name: 'GIFs' });
  const stickers = screen.getByRole('tab', { name: 'Stickers' });

  // `aria-selected` y no una clase de CSS: es lo que le dice a un lector de
  // pantalla cuál está activa, y una clase no se lo dice a nadie.
  assert.equal(gifs.getAttribute('aria-selected'), 'true');
  assert.equal(stickers.getAttribute('aria-selected'), 'false');
  cleanup();
});

test('cambiar de pestaña cambia el catálogo y lo que se busca', () => {
  abrirSelector();

  assert.ok(screen.getByPlaceholderText('Search GIFs'));
  assert.ok(screen.getByAltText('un gato'));

  fireEvent.click(screen.getByRole('tab', { name: 'Stickers' }));

  assert.ok(screen.getByPlaceholderText('Search stickers'));
  assert.ok(screen.getByAltText('un pato'), 'la rejilla tiene que traer el otro catálogo');
  assert.equal(screen.queryByAltText('un gato'), null);
  cleanup();
});

test('al elegir, dice de qué catálogo salió', () => {
  // Es el dato del que depende todo lo demás: sin él, el redactor no sabe si
  // marcar el mensaje como sticker.
  const elegidos: Array<[string, GifKind]> = [];
  abrirSelector((elegido, kind) => elegidos.push([elegido.id, kind]));

  fireEvent.click(screen.getByAltText('un gato'));
  fireEvent.click(screen.getByRole('tab', { name: 'Stickers' }));
  fireEvent.click(screen.getByAltText('un pato'));

  assert.deepEqual(elegidos, [
    ['gato', 'gif'],
    ['pato', 'sticker'],
  ]);
  cleanup();
});

test('el selector también habla español, y busca en español', () => {
  // Las semillas van con `es`: si el componente no mandara el idioma, no
  // encontraría ninguna y la rejilla saldría vacía. O sea que esta prueba
  // afirma dos cosas — los textos y el parámetro de búsqueda.
  montar(
    <GifPicker open onOpenChange={() => {}} onSelect={() => {}}>
      <button type="button">abrir</button>
    </GifPicker>,
    { locale: 'ES', semillas: semillasDe('es') },
  );

  assert.ok(screen.getByPlaceholderText('Buscar GIFs'));
  assert.ok(screen.getByAltText('un gato'), 'la búsqueda tiene que ir marcada como española');

  fireEvent.click(screen.getByRole('tab', { name: 'Stickers' }));
  assert.ok(screen.getByPlaceholderText('Buscar stickers'));
  cleanup();
});

test('la atribución de GIPHY se pinta cuando hay catálogo', () => {
  // No es decorativa: las condiciones de la clave gratuita la exigen.
  abrirSelector();
  assert.ok(screen.getByText('Powered by GIPHY'));
  cleanup();
});

test('y no se pinta cuando no hay clave configurada', () => {
  // Atribuir un servicio que no se está usando sería raro además de falso.
  montar(
    <GifPicker open onOpenChange={() => {}} onSelect={() => {}}>
      <button type="button">abrir</button>
    </GifPicker>,
    { semillas: [[queryKeys.gifs('', 'gif:en'), { configured: false, gifs: [] }]] },
  );

  assert.equal(screen.queryByText('Powered by GIPHY'), null);
  cleanup();
});

// ---------------------------------------------------------------------------
// La otra punta: cómo se pinta lo elegido
// ---------------------------------------------------------------------------

test('un sticker se pinta sin marco', () => {
  const { container } = montar(
    <MessageContent content={'![un pato](https://media.tenor.test/pato.gif "sticker")'} />,
  );

  const img = container.querySelector('img');
  assert.ok(img, 'el sticker tiene que pintarse');
  assert.ok(
    !(img?.getAttribute('class') ?? '').includes('border'),
    'un borde alrededor de una silueta recortada anula la transparencia',
  );
  cleanup();
});

test('una imagen normal conserva el suyo', () => {
  // El control: sin esto, un renderizador que quitara el marco a todo pasaría
  // la prueba de arriba sin haber distinguido nada.
  const { container } = montar(
    <MessageContent content={'![una foto](https://media.tenor.test/foto.png)'} />,
  );

  const clase = container.querySelector('img')?.getAttribute('class') ?? '';
  assert.ok(clase.includes('border'), `una foto sí lleva marco, y llevaba: ${clase}`);
  cleanup();
});

test('el título de markdown no se cuela como texto visible', () => {
  // `"sticker"` es una marca para el renderizador, no algo que nadie deba leer.
  const { container } = montar(
    <MessageContent content={'![un pato](https://media.tenor.test/pato.gif "sticker")'} />,
  );

  assert.equal((container.textContent ?? '').includes('sticker'), false);
  cleanup();
});
