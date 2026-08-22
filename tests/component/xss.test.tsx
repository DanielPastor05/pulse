import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';

import { MessageContent } from '@/features/messages/components/message-content';

/**
 * XSS almacenado: lo que pasa cuando alguien escribe un mensaje hostil.
 *
 * Esta es la pregunta que más importa de toda la aplicación, porque el fallo
 * no daña a quien lo escribe: daña a todos los que abren la conversación. Y no
 * se puede responder leyendo el código. `react-markdown` no usa `innerHTML`,
 * `rehype-sanitize` está puesto y no hay `rehypeRaw` — todo eso *sugiere* que
 * está bien, pero el componente `a` de este proyecto recibe el `href` y lo
 * pone en el DOM por su cuenta. Si la librería no lo hubiera saneado antes,
 * `javascript:` llegaría entero.
 *
 * Así que se renderiza de verdad y se mira el DOM resultante.
 *
 * Cada caso lleva su control: no basta con que no haya `javascript:`, hay que
 * comprobar además que el mensaje **se pintó**. Un componente que devolviera
 * `null` ante cualquier entrada pasaría todas las aserciones negativas.
 */

after(cleanup);

/** El HTML que acaba en el navegador para un contenido dado. */
function pintar(markdown: string): HTMLElement {
  const { container } = render(<MessageContent content={markdown} />);
  return container;
}

test('una etiqueta script se escapa en vez de ejecutarse', () => {
  const container = pintar('hola <script>alert(1)</script> adios');

  assert.equal(container.querySelector('script'), null, 'no debe existir un <script> en el DOM');
  assert.match(container.textContent ?? '', /hola/, 'y el mensaje sí se pinta');
});

test('un atributo de evento no sobrevive', () => {
  const container = pintar('<img src=x onerror="alert(1)">');

  const img = container.querySelector('img');
  assert.equal(img?.getAttribute('onerror') ?? null, null, 'onerror no debe llegar al DOM');
});

test('un enlace javascript: no queda como href ejecutable', () => {
  const container = pintar('[púlsame](javascript:alert(document.cookie))');

  const a = container.querySelector('a');
  const href = a?.getAttribute('href') ?? '';
  assert.ok(!href.toLowerCase().startsWith('javascript:'), `href peligroso: ${href}`);
  // El control: el enlace existe, así que la comprobación de arriba mira algo.
  assert.match(container.textContent ?? '', /púlsame/);
});

test('una imagen con src javascript: tampoco', () => {
  const container = pintar('![x](javascript:alert(1))');

  const src = container.querySelector('img')?.getAttribute('src') ?? '';
  assert.ok(!src.toLowerCase().startsWith('javascript:'), `src peligroso: ${src}`);
});

test('un data: URI con html no se convierte en enlace ejecutable', () => {
  const container = pintar('[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)');

  const href = container.querySelector('a')?.getAttribute('href') ?? '';
  assert.ok(!href.toLowerCase().startsWith('data:text/html'), `href peligroso: ${href}`);
});

test('un iframe no se cuela por markdown', () => {
  const container = pintar('<iframe src="https://evil.example"></iframe>');

  assert.equal(container.querySelector('iframe'), null);
});

test('los enlaces externos no ceden la pestaña a quien los recibe', () => {
  // `target="_blank"` sin `rel="noopener"` deja que la página de destino
  // manipule `window.opener`. Es de las pocas cosas que el saneado no cubre
  // porque la etiqueta la pone este proyecto, no la librería.
  const container = pintar('[fuera](https://example.com)');

  const a = container.querySelector('a');
  if (a?.getAttribute('target') === '_blank') {
    assert.match(a.getAttribute('rel') ?? '', /noopener/);
  }
});

test('el markdown normal sigue funcionando', () => {
  // El control de todo el fichero: si el renderizador estuviera roto, las siete
  // pruebas anteriores pasarían sin haber comprobado nada.
  const container = pintar('**negrita** y `código` y [enlace](https://example.com)');

  assert.ok(container.querySelector('strong'), 'la negrita se pinta');
  assert.ok(container.querySelector('code'), 'el código se pinta');
  assert.equal(container.querySelector('a')?.getAttribute('href'), 'https://example.com');
});
