import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ErrorEvent } from '@sentry/nextjs';

import { scrubEvent } from './sentry-scrub.ts';

function scrub(event: Partial<ErrorEvent>): ErrorEvent {
  return scrubEvent(event as ErrorEvent)!;
}

test('el contenido de un mensaje nunca sale del edificio', () => {
  const out = scrub({
    request: { data: { content: 'te veo a las 8 en casa de mi madre', conversationId: 'abc' } },
  });
  assert.equal((out.request?.data as Record<string, unknown>).content, '[redacted]');
  // Lo que sirve para reproducir el fallo sí sobrevive.
  assert.equal((out.request?.data as Record<string, unknown>).conversationId, 'abc');
});

test('las cadenas de consulta se tiran enteras', () => {
  const out = scrub({ request: { url: 'https://app.test/api/search?q=divorcio&limit=20' } });
  assert.equal(out.request?.url, 'https://app.test/api/search?[redacted]');
});

test('cookies y cabeceras no viajan', () => {
  const out = scrub({
    request: {
      cookies: { 'sb-auth-token': 'secreto' },
      headers: { authorization: 'Bearer secreto' },
    },
  });
  assert.equal(out.request?.cookies, undefined);
  assert.equal(out.request?.headers, undefined);
});

test('del usuario sólo queda el id', () => {
  const out = scrub({
    user: { id: 'u1', email: 'dani@ejemplo.test', username: 'dani', ip_address: '1.2.3.4' },
  });
  assert.deepEqual(out.user, { id: 'u1' });
});

test('los campos sensibles se limpian tambien anidados', () => {
  const out = scrub({ extra: { payload: { draft: 'a medio escribir', ok: 1 } } });
  const payload = (out.extra as { payload: Record<string, unknown> }).payload;
  assert.equal(payload.draft, '[redacted]');
  assert.equal(payload.ok, 1);
});

test('las migas de consola se redactan, que es donde se cuela el texto', () => {
  const out = scrub({
    breadcrumbs: [
      { category: 'console', message: 'enviando: hola guapa' },
      { category: 'navigation', message: '/chat/123' },
    ],
  });
  assert.equal(out.breadcrumbs?.[0]?.message, '[redacted]');
  assert.equal(out.breadcrumbs?.[1]?.message, '/chat/123');
});

test('el volcado que Prisma cuelga del mensaje de error no viaja', () => {
  // Forma real de un PrismaClientValidationError: la primera línea resume y
  // debajo va el objeto de argumentos entero, con el mensaje dentro.
  const real = [
    'Invalid `prisma.message.create()` invocation:',
    '{',
    '  data: {',
    '    conversationId: "abc",',
    '    content: "te veo a las 8 en casa de mi madre",',
    '  }',
    '}',
  ].join('\n');

  const out = scrub({ exception: { values: [{ type: 'Error', value: real }] } });
  const salida = out.exception?.values?.[0]?.value ?? '';

  assert.equal(salida.includes('casa de mi madre'), false, 'el texto no puede salir');
  assert.ok(salida.startsWith('Invalid `prisma.message.create()`'), 'el resumen sí sirve y se queda');
});

test('un error de una sola línea llega entero, porque es lo útil', () => {
  const out = scrub({
    exception: { values: [{ type: 'Error', value: 'Connection terminated unexpectedly' }] },
  });
  assert.equal(out.exception?.values?.[0]?.value, 'Connection terminated unexpectedly');
});

test('un mensaje suelto tambien se recorta', () => {
  const out = scrub({ message: 'Fallo al enviar\ncontent: "hola guapa"' });
  assert.equal(String(out.message).includes('hola guapa'), false);
});

test('una estructura profunda o circular no cuelga el proceso', () => {
  const deep: Record<string, unknown> = { content: 'secreto' };
  let node = deep;
  for (let i = 0; i < 10; i++) node = node.next = { content: 'secreto', depth: i };

  const out = scrub({ extra: { deep } });
  assert.equal((out.extra as { deep: Record<string, unknown> }).deep.content, '[redacted]');
});
