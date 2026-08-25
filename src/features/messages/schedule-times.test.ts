import assert from 'node:assert/strict';
import test from 'node:test';

import { aValorLocal, calcularAtajo } from './schedule-times.ts';

/*
 * Los atajos de hora del diálogo de programación.
 *
 * Se prueban aquí y no en el componente porque el fallo que tienen no es de
 * pintado: es que «esta tarde» a las nueve de la noche propone una hora que ya
 * ha pasado. El servidor la rechaza por estar en el pasado y el error parece
 * suyo, cuando lo puso el cliente.
 *
 * `ahora` entra por parámetro justamente para poder ponerse a esa hora sin
 * esperar a que lo sea.
 */

/** Una hora local concreta, construida sin zona para que sea la del sistema. */
function local(anio: number, mes: number, dia: number, hora: number, minuto = 0): Date {
  return new Date(anio, mes - 1, dia, hora, minuto, 0, 0);
}

test('dentro de una hora es exactamente una hora después', () => {
  const ahora = local(2026, 8, 25, 14, 30);
  assert.equal(calcularAtajo('inOneHour', ahora).getTime() - ahora.getTime(), 60 * 60_000);
});

test('esta tarde son las ocho de hoy cuando aún no han pasado', () => {
  const propuesto = calcularAtajo('thisEvening', local(2026, 8, 25, 14, 30));
  assert.equal(propuesto.getDate(), 25);
  assert.equal(propuesto.getHours(), 20);
  assert.equal(propuesto.getMinutes(), 0);
});

test('y las de mañana cuando ya han pasado', () => {
  // El caso que importa: a las 21:00, «esta tarde» no puede ser hoy.
  const ahora = local(2026, 8, 25, 21, 0);
  const propuesto = calcularAtajo('thisEvening', ahora);
  assert.equal(propuesto.getDate(), 26);
  assert.equal(propuesto.getHours(), 20);
  assert.ok(propuesto > ahora, 'un atajo nunca puede proponer una hora pasada');
});

test('justo a las ocho en punto ya cuenta como pasada', () => {
  // El límite exacto. Con `<` en vez de `<=` esto propondría la hora actual, y
  // para cuando el mensaje llegara al servidor ya sería pasado.
  const ahora = local(2026, 8, 25, 20, 0);
  assert.ok(calcularAtajo('thisEvening', ahora) > ahora);
});

test('mañana por la mañana son las nueve del día siguiente', () => {
  const propuesto = calcularAtajo('tomorrowMorning', local(2026, 8, 25, 23, 40));
  assert.equal(propuesto.getDate(), 26);
  assert.equal(propuesto.getHours(), 9);
});

test('los tres atajos caen siempre en el futuro, a cualquier hora del día', () => {
  // El control que cubre lo que los casos sueltos no: recorrer las 24 horas y
  // exigir la única propiedad que todos comparten.
  for (let hora = 0; hora < 24; hora += 1) {
    const ahora = local(2026, 8, 25, hora, 15);
    for (const clave of ['inOneHour', 'thisEvening', 'tomorrowMorning'] as const) {
      assert.ok(
        calcularAtajo(clave, ahora) > ahora,
        `${clave} propuso una hora pasada a las ${hora}:15`,
      );
    }
  }
});

test('el valor del selector es la hora del reloj de quien mira, no UTC', () => {
  const fecha = local(2026, 8, 25, 15, 30);
  assert.equal(aValorLocal(fecha), '2026-08-25T15:30');

  // El control: `toISOString()` a secas sólo coincide en UTC. Fuera de UTC
  // daría otra hora, y esa es exactamente la confusión que esta función evita.
  if (fecha.getTimezoneOffset() !== 0) {
    assert.notEqual(fecha.toISOString().slice(0, 16), aValorLocal(fecha));
  }
});

test('y lo que produce se vuelve a leer como la misma hora', () => {
  // La vuelta completa, que es lo que de verdad ocurre: se pinta en el input,
  // alguien lo deja como está, y `new Date(valor)` tiene que dar lo mismo.
  const fecha = local(2026, 12, 31, 23, 59);
  assert.equal(new Date(aValorLocal(fecha)).getTime(), fecha.getTime());
});
