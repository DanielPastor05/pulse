import assert from 'node:assert/strict';
import test from 'node:test';

// Relativo y con extensión, como el resto de pruebas unitarias: `node --test`
// no resuelve el alias `@/`, que sólo existe para el compilador y el empaquetador.
import { conAlcanceDePeticion, memoDePeticion } from './request-scope.ts';

/*
 * Estas comprobaciones existen porque la primera versión de esto usaba
 * `cache()` de React y **no memoizaba nada** dentro de un route handler: la
 * consulta se ejecutaba dos veces por petición y todo —tipos, lint, build, y la
 * aplicación entera— seguía funcionando igual, sólo que pagando el doble.
 *
 * Un fallo así no se ve, así que hace falta contar ejecuciones. Cada
 * comprobación de aquí abajo cuenta.
 */

/** Una función que lleva la cuenta de las veces que se ejecuta de verdad. */
function contada<T>(valor: T) {
  const estado = { veces: 0 };
  return [
    async () => {
      estado.veces += 1;
      return valor;
    },
    estado,
  ] as const;
}

test('dentro de un alcance, la misma clave se ejecuta una sola vez', async () => {
  const [hacer, estado] = contada('miembro');

  const resultado = await conAlcanceDePeticion(async () => {
    const a = await memoDePeticion('k', hacer);
    const b = await memoDePeticion('k', hacer);
    return [a, b];
  });

  assert.deepEqual(resultado, ['miembro', 'miembro']);
  assert.equal(estado.veces, 1, 'la segunda llamada debía salir del memo');
});

test('claves distintas no se pisan', async () => {
  const [uno, estadoUno] = contada(1);
  const [dos, estadoDos] = contada(2);

  const resultado = await conAlcanceDePeticion(async () => [
    await memoDePeticion('a', uno),
    await memoDePeticion('b', dos),
    await memoDePeticion('a', uno),
  ]);

  assert.deepEqual(resultado, [1, 2, 1]);
  assert.equal(estadoUno.veces, 1);
  assert.equal(estadoDos.veces, 1);
});

test('el memo no cruza de un alcance a otro', async () => {
  // El control que le faltaba a la primera medición: si el memo se compartiera
  // entre peticiones, «una sola ejecución» también sería lo que se vería, y
  // sería un fallo mucho peor que el que se está arreglando — la pertenencia de
  // una petición contestando a la siguiente.
  const [hacer, estado] = contada('x');

  await conAlcanceDePeticion(async () => memoDePeticion('k', hacer));
  await conAlcanceDePeticion(async () => memoDePeticion('k', hacer));

  assert.equal(estado.veces, 2, 'cada petición tiene que consultar por su cuenta');
});

test('fuera de un alcance ejecuta siempre, no memoiza', async () => {
  const [hacer, estado] = contada('x');

  await memoDePeticion('k', hacer);
  await memoDePeticion('k', hacer);

  assert.equal(estado.veces, 2);
});

test('dos llamadas concurrentes con la misma clave comparten una ejecución', async () => {
  // Guardar la promesa y no el valor: el manejador y el servicio pueden acabar
  // pidiendo lo mismo a la vez, y dos consultas idénticas en vuelo son
  // exactamente lo que esto viene a quitar.
  const estado = { veces: 0 };
  const lento = async () => {
    estado.veces += 1;
    await new Promise((listo) => setTimeout(listo, 20));
    return 'tarde';
  };

  const resultado = await conAlcanceDePeticion(async () =>
    Promise.all([memoDePeticion('k', lento), memoDePeticion('k', lento)]),
  );

  assert.deepEqual(resultado, ['tarde', 'tarde']);
  assert.equal(estado.veces, 1);
});

test('un rechazo se memoiza igual que un valor', async () => {
  // Si no es miembro, no lo va a ser dos líneas más abajo: reintentar la
  // consulta sólo para volver a fallar es la mitad del coste que se quería
  // quitar, y encima en el camino de quien no tiene permiso.
  const estado = { veces: 0 };
  const falla = async () => {
    estado.veces += 1;
    throw new Error('403');
  };

  await conAlcanceDePeticion(async () => {
    await assert.rejects(() => memoDePeticion('k', falla), /403/);
    await assert.rejects(() => memoDePeticion('k', falla), /403/);
  });

  assert.equal(estado.veces, 1);
});
