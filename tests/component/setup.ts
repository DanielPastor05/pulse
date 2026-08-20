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
