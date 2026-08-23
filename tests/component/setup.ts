import { GlobalRegistrator } from '@happy-dom/global-registrator';

/**
 * Un DOM para las pruebas de componente.
 *
 * `happy-dom` y no `jsdom`: arranca en decenas de milisegundos en vez de en
 * cientos, y lo que se prueba aquí —qué se pinta, qué atributos lleva, qué pasa
 * al pulsar— no necesita nada de lo que jsdom implementa de más.
 *
 * Se registra antes de que nadie importe React, así que este módulo va en el
 * `--import` del ejecutor y no dentro de cada fichero de prueba.
 */
GlobalRegistrator.register({ url: 'https://pulse.test/chat' });

/**
 * React 19 comprueba esta bandera para decidir si está dentro de `act()`.
 *
 * Sin ella, cada render suelta un aviso por consola sobre actualizaciones no
 * envueltas y la salida de la tanda deja de ser legible — que es como se acaba
 * ignorando un aviso que algún día importará.
 */
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Ninguna prueba de componente sale a la red.
 *
 * No es una precaución teórica: al montar los primeros componentes, la tanda
 * empezó a soltar `getaddrinfo ENOTFOUND pulse.test` y a terminar con código
 * 255 **con las catorce pruebas en verde**. Algo pedía una URL relativa contra
 * el host falso del DOM, y como el fallo llegaba fuera de toda prueba, no había
 * forma de saber cuál.
 *
 * Sustituir `fetch` convierte ese ruido en un error que nombra la URL y el
 * componente que la pidió. Y deja la propiedad que interesa: si una prueba de
 * componente necesita la red, es que está probando otra cosa.
 */
const fetchProhibido: typeof fetch = (input) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return Promise.reject(
    new Error(
      `una prueba de componente ha intentado ir a la red: ${url}\n` +
        'Si el componente necesita datos, dáselos por props o por el cliente de consultas.',
    ),
  );
};
globalThis.fetch = fetchProhibido;
