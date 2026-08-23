import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import * as React from 'react';
import { cleanup, screen } from '@testing-library/react';

import { TypingIndicator } from '@/features/messages/components/typing-indicator';
import { montar } from './harness.tsx';

/**
 * El componente que descubrió por qué faltaban estas pruebas.
 *
 * Al montarlo por primera vez pintaba **«Marta is typing» con la interfaz en
 * español**. Llevaba así desde la traducción: las cadenas vivían dentro de una
 * función auxiliar, no en el JSX, así que el detector por AST que barrió el
 * resto de la aplicación no las vio, y en el inventario de dependencias este
 * fichero aparecía como «sin i18n» — el síntoma exacto, leído como si fuera una
 * propiedad del componente.
 *
 * Ninguna prueba de servidor podía cazarlo. El texto no cruza la API: se compone
 * en el navegador a partir de nombres que llegan por el canal de tiempo real.
 * Es el argumento entero a favor de renderizar componentes.
 */

after(cleanup);

test('sin nadie escribiendo no pinta nada', () => {
  const { container } = montar(<TypingIndicator names={[]} />);

  assert.equal(container.textContent, '', 'el hueco tiene que desaparecer, no quedarse vacío');
  cleanup();
});

test('una persona', () => {
  montar(<TypingIndicator names={['Marta']} />);

  assert.ok(screen.getByText('Marta is typing'));
  cleanup();
});

test('dos personas se nombran las dos', () => {
  // Con dos caben los dos nombres, y saber quién escribe cambia si esperas.
  montar(<TypingIndicator names={['Marta', 'Kenji']} />);

  assert.ok(screen.getByText('Marta and Kenji are typing'));
  cleanup();
});

test('a partir de tres, el resto se cuenta', () => {
  montar(<TypingIndicator names={['Marta', 'Kenji', 'Aisha', 'Dani']} />);

  assert.ok(screen.getByText('Marta and 3 others are typing'));
  cleanup();
});

test('en español, y con el verbo concordado', () => {
  // La razón de que sean tres claves y no una plantilla con contador: en
  // español el verbo cambia («está» / «están»), así que una sola forma
  // obligaría a escribir «1 persona está escribiendo», que no lo dice nadie.
  montar(<TypingIndicator names={['Marta']} />, { locale: 'ES' });
  assert.ok(screen.getByText('Marta está escribiendo'));
  cleanup();

  montar(<TypingIndicator names={['Marta', 'Kenji']} />, { locale: 'ES' });
  assert.ok(screen.getByText('Marta y Kenji están escribiendo'));
  cleanup();

  montar(<TypingIndicator names={['Marta', 'Kenji', 'Aisha']} />, { locale: 'ES' });
  assert.ok(screen.getByText('Marta y 2 más están escribiendo'));
  cleanup();
});

test('con tres escribiendo, «y 1 más» se dice de otra forma', () => {
  // `others === 1` es el caso que una plantilla con `${n} más` deja en «y 1
  // más», que se lee como un número de teléfono. Sale con exactamente tres
  // personas, que es de lo más normal en un grupo.
  montar(<TypingIndicator names={['Marta', 'Kenji']} />, { locale: 'ES' });
  cleanup();

  montar(<TypingIndicator names={['Marta', 'Kenji', 'Aisha']} />, { locale: 'ES' });
  assert.equal(screen.queryByText(/y 1 más/), null);
  cleanup();
});

test('el aviso es audible para un lector de pantalla', () => {
  // Quien no ve la pantalla necesita que el cambio se anuncie. `polite` y no
  // `assertive`: que alguien esté escribiendo no interrumpe lo que se esté
  // leyendo en ese momento.
  const { container } = montar(<TypingIndicator names={['Marta']} />);

  assert.equal(container.querySelector('[aria-live]')?.getAttribute('aria-live'), 'polite');
  cleanup();
});
