import assert from 'node:assert/strict';
import { enUS, es } from 'date-fns/locale';
import { test } from 'node:test';

import { createDateFormatters } from './date.ts';

/**
 * Las fechas fueron lo último que quedó en inglés, y se descubrió mirando una
 * captura: la interfaz entera en español y, en la lista de miembros, «entró
 * 4 days ago». No lo detectó ningún buscador de textos porque no hay ninguna
 * cadena en inglés en el código — la producía `date-fns` con su idioma por
 * defecto.
 *
 * Por eso se prueba el resultado y no la existencia de una clave: lo que se
 * puede romper aquí es que el idioma no llegue hasta la librería.
 */

const TEXTOS_ES = {
  today: 'Hoy',
  yesterday: 'Ayer',
  at: 'a las',
  activeJustNow: 'activo ahora mismo',
  activeAgo: (when: string) => `activo ${when}`,
};

const TEXTOS_EN = {
  today: 'Today',
  yesterday: 'Yesterday',
  at: 'at',
  activeJustNow: 'active just now',
  activeAgo: (when: string) => `active ${when}`,
};

/** Una fecha fija: los días de la semana y los meses tienen que ser estables. */
const UN_MARTES_DE_MARZO = new Date('2026-03-17T09:41:00Z').toISOString();

test('el nombre del mes sale en el idioma que se pide, no en el de la librería', () => {
  const español = createDateFormatters(es, TEXTOS_ES);
  const inglés = createDateFormatters(enUS, TEXTOS_EN);

  assert.match(español.formatDaySeparator(UN_MARTES_DE_MARZO), /marzo/);
  assert.match(inglés.formatDaySeparator(UN_MARTES_DE_MARZO), /March/);
});

test('la distancia relativa también viaja traducida', () => {
  // El caso exacto de la captura: «joined 4 days ago» dentro de una frase que
  // ya estaba en español.
  const hace = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();

  assert.match(createDateFormatters(es, TEXTOS_ES).formatRelative(hace), /hace 4 días/);
  assert.match(createDateFormatters(enUS, TEXTOS_EN).formatRelative(hace), /4 days ago/);
});

test('«ayer» sale del diccionario y no de date-fns', () => {
  const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // `date-fns` no tiene una idea propia de «ayer» para estos formatos: la frase
  // es de la aplicación, así que tiene que venir del diccionario o no vendrá.
  assert.equal(createDateFormatters(es, TEXTOS_ES).formatListTime(ayer), 'Ayer');
  assert.equal(createDateFormatters(enUS, TEXTOS_EN).formatListTime(ayer), 'Yesterday');
});

test('recién visto no dice «hace 0 segundos»', () => {
  // Menos de un minuto tiene su propia frase: «activo hace 3 segundos» es
  // ruido, y a esa escala el dato no es ni siquiera cierto.
  const ahora = new Date().toISOString();

  assert.equal(createDateFormatters(es, TEXTOS_ES).formatLastSeen(ahora), 'activo ahora mismo');
});

test('la hora del día no cambia con el idioma', () => {
  // 24 horas en los dos: es una decisión de la aplicación, no del idioma, y
  // pasar a AM/PM en inglés cambiaría el ancho de cada fila de la lista.
  const español = createDateFormatters(es, TEXTOS_ES);
  const inglés = createDateFormatters(enUS, TEXTOS_EN);
  const hoy = new Date();
  hoy.setHours(15, 30, 0, 0);

  assert.equal(español.formatListTime(hoy.toISOString()), '15:30');
  assert.equal(inglés.formatListTime(hoy.toISOString()), '15:30');
});
