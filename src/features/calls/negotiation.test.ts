import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { isPolite } from './negotiation.ts';

/**
 * El patrón de negociación perfecta descansa en un único invariante: ante una
 * colisión de ofertas, exactamente uno de los dos extremos cede. Si ceden los
 * dos no se conecta nadie; si no cede ninguno, ambos abortan con
 * InvalidStateError y la llamada muere sin causa visible.
 *
 * Y tienen que decidirlo por separado, porque justo en ese momento no se están
 * escuchando.
 */
test('de dos pares, exactamente uno es el educado', () => {
  for (let i = 0; i < 500; i++) {
    const a = randomUUID();
    const b = randomUUID();
    assert.notEqual(isPolite(a, b), isPolite(b, a), `${a} vs ${b}`);
  }
});

test('cada extremo llega al mismo reparto sin consultar al otro', () => {
  const a = 'a0000000-0000-0000-0000-000000000000';
  const b = 'b0000000-0000-0000-0000-000000000000';

  // Lo que calcula A sobre sí mismo tiene que ser lo contrario de lo que
  // calcula B sobre sí mismo.
  assert.equal(isPolite(a, b), true);
  assert.equal(isPolite(b, a), false);
});

test('el reparto no cambia entre llamadas', () => {
  const a = randomUUID();
  const b = randomUUID();
  const primera = isPolite(a, b);
  for (let i = 0; i < 10; i++) assert.equal(isPolite(a, b), primera);
});
