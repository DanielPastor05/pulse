import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

/**
 * Una mutación que cambia el servidor y no toca la caché deja la pantalla
 * mintiendo.
 *
 * Pasó dos veces el 25/08/2026, y la segunda es la que enseña algo:
 *
 *   1. Bloquear a alguien desde el panel de detalles no cambiaba nada. El
 *      servidor bloqueaba de verdad, pero `blockedByMe` vive en el detalle de
 *      la conversación y ese detalle seguía en caché: el botón seguía diciendo
 *      «bloquear» y el redactor seguía dejando escribir. Sólo cambiaba pasando
 *      por Ajustes → Gente y volviendo.
 *   2. Y lo que engaña: **ya se había arreglado esa misma mañana**. La
 *      invalidación se le añadió a `useSetBlocked`... que este panel no usaba,
 *      porque tenía su propia copia escrita a mano llamando al mismo endpoint.
 *      Arreglar el hook no arregla a quien no lo llama.
 *
 * Ninguna prueba de las que hay podía cazarlo: las de extremo a extremo hablan
 * con la API directamente, así que ven el servidor haciendo lo correcto. El
 * fallo estaba entre la respuesta y la pantalla.
 *
 * Así que la regla se comprueba leyendo: **toda `useMutation` dentro de un
 * componente refresca algo, o dice por qué no.** La salida es un comentario
 * `sin-cache:` con el motivo, que obliga a haberlo pensado en vez de a haberlo
 * olvidado. Hay motivos buenos —el canal en vivo ya avisa a todo el mundo, o no
 * hay nada en caché que enseñe eso— y son justo los que conviene tener escritos.
 *
 * Lo que NO cubre, dicho para que nadie lo lea como más de lo que es: sólo mira
 * `useMutation` en ficheros de `components/`, no si lo que se invalida es la
 * clave correcta. Un `invalidateQueries` apuntando a la clave equivocada pasa
 * esta prueba. Cubre el olvido, no el error.
 */

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));

function componentes(directorio: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) salida.push(...componentes(ruta));
    else if (entrada.name.endsWith('.tsx') && directorio.includes('components')) salida.push(ruta);
  }
  return salida;
}

/** Señales de que la mutación sí refresca lo que se ve. */
const REFRESCA = [
  'invalidateQueries',
  'setQueryData',
  // El ayudante propio del proyecto para la sesión. Va en la lista porque hace
  // exactamente lo mismo por dentro, y sin él esta prueba acusaría a dos
  // componentes que sí refrescan — un guardián que señala a los inocentes deja
  // de leerse a la tercera.
  'patchSession',
  // Una navegación dura recarga la aplicación entera, así que no queda caché
  // que corregir.
  'hardNavigate',
];

/** La salida explícita: un comentario que dice por qué no hace falta. */
const EXCUSA = /\/\/\s*sin-cache:|\*\s*sin-cache:/;

/**
 * Recorta el cuerpo de cada `useMutation({...})` contando llaves.
 *
 * Contar llaves y no una expresión regular perezosa: los cuerpos llevan objetos
 * anidados —`body: { … }`— y un `[\s\S]*?\}\)` corta en el primero, dejando
 * fuera justo el `onSuccess` donde vive la invalidación. Se leería como que
 * ninguna mutación refresca nada.
 */
function cuerposDeMutacion(fuente: string): string[] {
  const cuerpos: string[] = [];
  const marca = 'useMutation({';
  let desde = 0;

  for (;;) {
    const inicio = fuente.indexOf(marca, desde);
    if (inicio === -1) break;

    let profundidad = 0;
    let fin = inicio + marca.length - 1;
    for (let i = fin; i < fuente.length; i += 1) {
      if (fuente[i] === '{') profundidad += 1;
      else if (fuente[i] === '}') {
        profundidad -= 1;
        if (profundidad === 0) {
          fin = i;
          break;
        }
      }
    }

    // Se incluyen las líneas de antes: el comentario que explica por qué no
    // hace falta caché se escribe encima de la llamada, no dentro.
    const contexto = fuente.slice(Math.max(0, inicio - 600), fin + 1);
    cuerpos.push(contexto);
    desde = fin + 1;
  }

  return cuerpos;
}

test('toda mutación de un componente refresca algo, o dice por qué no', () => {
  const ficheros = componentes(join(RAIZ, 'src'));
  assert.ok(ficheros.length > 0, 'no se encontró ningún componente; ¿cambió la estructura?');

  const mudas: string[] = [];
  let vistas = 0;

  for (const ruta of ficheros) {
    const fuente = readFileSync(ruta, 'utf8');
    for (const cuerpo of cuerposDeMutacion(fuente)) {
      vistas += 1;
      const refresca = REFRESCA.some((senal) => cuerpo.includes(senal));
      if (!refresca && !EXCUSA.test(cuerpo)) {
        mudas.push(ruta.replace(RAIZ, ''));
      }
    }
  }

  // El control: si el recortador estuviera roto y no encontrara ninguna
  // mutación, la lista saldría vacía y esto pasaría sin haber mirado nada.
  assert.ok(vistas >= 5, `sólo se leyeron ${vistas} mutaciones; el recortador no está mirando`);

  assert.deepEqual(
    mudas,
    [],
    'mutaciones que cambian el servidor sin refrescar la pantalla ni explicar por qué:\n  ' +
      mudas.join('\n  '),
  );
});
