import assert from 'node:assert/strict';
import test from 'node:test';

import { superaErrores, superaLatencia, tasaDeError } from './budgets.ts';

const fila = (parcial: Partial<Parameters<typeof superaErrores>[0]> = {}) => ({
  route: '/api/x',
  samples: 100,
  p95: 200,
  errors: 0,
  ...parcial,
});

// ---------------------------------------------------------------------------
// Latencia
// ---------------------------------------------------------------------------

test('un p95 por encima del presupuesto avisa', () => {
  assert.equal(superaLatencia(fila({ p95: 1500 }), 1000), true);
});

test('un p95 justo en el presupuesto no avisa', () => {
  // El límite es «por encima», no «a partir de». Un endpoint clavado en su
  // presupuesto lo está cumpliendo.
  assert.equal(superaLatencia(fila({ p95: 1000 }), 1000), false);
});

test('con pocas muestras no se avisa aunque el p95 sea horrible', () => {
  // La razón entera de que exista el mínimo: tres peticiones no tienen p95.
  assert.equal(superaLatencia(fila({ samples: 3, p95: 9000 }), 1000), false);
});

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

test('sin errores no se avisa', () => {
  assert.equal(superaErrores(fila({ errors: 0 })), false);
});

test('un error suelto entre muchas peticiones no avisa', () => {
  // 1 de 1000 es 0,1%, por debajo del 1%. Y Sentry ya lo tiene por su cuenta.
  assert.equal(superaErrores(fila({ samples: 1000, errors: 1 })), false);
});

test('un goteo por encima del 1% avisa', () => {
  assert.equal(superaErrores(fila({ samples: 1000, errors: 15 })), true);
});

test('una ruta poco transitada pero rota del todo avisa', () => {
  // Cinco peticiones y cinco errores nunca llegan al mínimo de muestras: sin el
  // umbral absoluto, esta ruta se quedaría en silencio para siempre. Es el caso
  // que más importa y el que una regla de sólo porcentaje pierde.
  assert.equal(superaErrores(fila({ samples: 5, errors: 5 })), true);
});

test('dos errores en una ruta con poco tráfico todavía no avisan', () => {
  // La otra cara del umbral absoluto: por debajo de tres, se considera ruido.
  assert.equal(superaErrores(fila({ samples: 4, errors: 2 })), false);
});

test('la tasa se redondea a algo legible', () => {
  assert.equal(tasaDeError(fila({ samples: 3, errors: 1 })), 0.3333);
  assert.equal(tasaDeError(fila({ samples: 0, errors: 0 })), 0);
});
