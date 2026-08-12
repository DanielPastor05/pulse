import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { dequeue, enqueue, isQueued, pending, type OutboxEntry } from './outbox.ts';

/** localStorage mínimo: el módulo sólo usa getItem/setItem. */
function installStorage(broken = false) {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (broken) throw new Error('QuotaExceededError');
      data.set(key, value);
    },
  };
  (globalThis as { window?: unknown }).window = { localStorage: storage };
  return data;
}

const entry = (clientId: string, conversationId = 'c1'): OutboxEntry => ({
  clientId,
  conversationId,
  content: `mensaje ${clientId}`,
  attachments: [],
  replyToId: null,
  queuedAt: Date.now(),
});

beforeEach(() => installStorage());

test('un mensaje encolado sobrevive y se puede consultar', () => {
  enqueue(entry('a'));
  assert.equal(isQueued('a'), true);
  assert.equal(pending().length, 1);
});

test('encolar dos veces el mismo clientId no lo duplica', () => {
  // Pasa de verdad: se reintenta un envío que ya estaba en la cola.
  enqueue(entry('a'));
  enqueue(entry('a'));
  assert.equal(pending().length, 1);
});

test('sacar de la cola sólo quita el indicado', () => {
  enqueue(entry('a'));
  enqueue(entry('b'));
  dequeue('a');
  assert.deepEqual(
    pending().map((item) => item.clientId),
    ['b'],
  );
});

test('se puede filtrar por conversación', () => {
  enqueue(entry('a', 'c1'));
  enqueue(entry('b', 'c2'));
  assert.equal(pending('c1').length, 1);
  assert.equal(pending('c2').length, 1);
  assert.equal(pending().length, 2);
});

test('un almacenamiento corrupto no revienta, devuelve vacío', () => {
  const data = installStorage();
  data.set('pulse.outbox.v1', 'esto no es json');
  assert.deepEqual(pending(), []);
});

test('si localStorage está lleno, encolar no lanza', () => {
  installStorage(true);
  // Perder la cola es mejor que romper el envío en el que está el usuario.
  assert.doesNotThrow(() => enqueue(entry('a')));
});

test('la cola se recorta y conserva lo más reciente', () => {
  for (let i = 0; i < 130; i++) enqueue(entry(`m${i}`));
  const queued = pending();
  assert.equal(queued.length, 100);
  assert.equal(queued.at(-1)?.clientId, 'm129');
});
