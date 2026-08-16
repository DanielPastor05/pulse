import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as Sentry from '@sentry/node';

import { scrubEvent } from './sentry-scrub.ts';

/**
 * Qué sale de verdad por el cable.
 *
 * Las otras pruebas llaman a `scrubEvent` directamente, lo que demuestra que la
 * función hace su trabajo pero no que esté conectada — un `beforeSend` mal
 * puesto, un campo que el SDK añade después de filtrar, o una serialización que
 * vuelve a meter lo que se quitó, pasarían desapercibidos.
 *
 * Aquí se inicializa el SDK real y se le da un transporte propio que, en vez de
 * enviar, guarda el sobre. Lo que se inspecciona es exactamente lo que habría
 * viajado a Sentry, ya serializado. Sin cuenta, sin red y sin mirar un panel.
 */
function capture(error: unknown, { filtrar = true } = {}): Promise<string> {
  return new Promise((resolve) => {
    const enviados: string[] = [];

    const client = new Sentry.NodeClient({
      dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
      // El sobre entero como texto: si el canario sobrevive en cualquier campo,
      // por anidado que esté, aparece aquí.
      transport: () => ({
        send: async (envelope) => {
          enviados.push(JSON.stringify(envelope));
          return {};
        },
        flush: async () => true,
      }),
      // `filtrar: false` es el control positivo: sirve para comprobar que esta
      // prueba puede fallar. Sin él, cuatro asserts de «no aparece» pasarían
      // igual si el SDK no estuviera enviando nada en absoluto.
      ...(filtrar ? { beforeSend: scrubEvent } : {}),
      integrations: [],
      stackParser: Sentry.defaultStackParser,
    });

    const scope = new Sentry.Scope();
    scope.setClient(client);
    client.init();

    scope.captureException(error);
    void client.flush(2000).then(() => resolve(enviados.join('\n')));
  });
}

test('el volcado de Prisma no llega al sobre que se envía', async () => {
  // La forma real: primera línea de resumen, y debajo el objeto de argumentos
  // con el mensaje que la persona estaba escribiendo.
  const error = new Error(
    [
      'Invalid `prisma.message.create()` invocation:',
      '{',
      '  data: {',
      '    conversationId: "abc",',
      '    content: "CANARIO-SECRETO-NO-DEBE-SALIR",',
      '  }',
      '}',
    ].join('\n'),
  );

  const sobre = await capture(error);

  assert.equal(
    sobre.includes('CANARIO-SECRETO-NO-DEBE-SALIR'),
    false,
    'el contenido del mensaje salió por el cable',
  );
  assert.ok(
    sobre.includes('prisma.message.create'),
    'el resumen sí debe viajar, o el evento no sirve para nada',
  );
});

test('control positivo: sin el filtro, el canario sí sale', async () => {
  const error = new Error(
    'Invalid `prisma.message.create()` invocation:\n  content: "CANARIO-SECRETO-NO-DEBE-SALIR"',
  );

  const sobre = await capture(error, { filtrar: false });

  // Si esto fallara, la prueba de arriba estaría pasando en vacío: querría
  // decir que el sobre nunca lleva el mensaje del error, y entonces no
  // demostraría nada sobre el filtro.
  assert.ok(
    sobre.includes('CANARIO-SECRETO-NO-DEBE-SALIR'),
    'sin filtro el texto debería viajar; si no viaja, la otra prueba no prueba nada',
  );
});

test('lo que se adjunta al alcance tampoco escapa', async () => {
  const error = new Error('Algo falló');
  Sentry.getCurrentScope().setExtra('draft', 'CANARIO-EN-EXTRA');

  const sobre = await capture(error);

  assert.equal(sobre.includes('CANARIO-EN-EXTRA'), false);
  Sentry.getCurrentScope().clear();
});
