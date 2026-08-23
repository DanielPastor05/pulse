import assert from 'node:assert/strict';
import * as React from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { Locale } from '@prisma/client';

import { LocaleProvider } from '@/i18n/provider';
import { TooltipProvider } from '@/components/ui/tooltip';

/**
 * Lo que hace falta para que un componente de esta aplicación se pueda montar.
 *
 * La auditoría dejó la interfaz como su laguna más grande: de todo el frontend
 * sólo se renderizaba en pruebas el componente que pinta un mensaje. El motivo
 * no era técnico sino de fricción — cada componente pide idioma, router y
 * cliente de consultas, y montarlos a mano en cada fichero es tedioso, así que
 * no se hacía. Esto lo monta una vez.
 *
 * Los proveedores son los de verdad, los mismos que la aplicación pone en su
 * layout. Sustituirlos por dobles simplificaría el arnés y probaría un entorno
 * en el que el componente nunca se ejecuta.
 */

/** Un router que anota lo que le piden, para poder afirmar sobre la navegación. */
export type RouterFalso = AppRouterInstance & {
  llamadas: Array<{ metodo: string; argumento?: string }>;
};

function routerFalso(): RouterFalso {
  const llamadas: RouterFalso['llamadas'] = [];
  const anotar = (metodo: string) => (argumento?: string) => {
    llamadas.push({ metodo, argumento });
  };

  return {
    llamadas,
    push: anotar('push'),
    replace: anotar('replace'),
    back: anotar('back'),
    forward: anotar('forward'),
    refresh: anotar('refresh'),
    prefetch: anotar('prefetch'),
  } as RouterFalso;
}

export type ResultadoMontaje = RenderResult & { router: RouterFalso };

/**
 * Monta `ui` con los proveedores de la aplicación.
 *
 * Dos ajustes del cliente de consultas, y el segundo costó encontrarlo:
 *
 * - `retry: false`, porque por defecto React Query reintenta tres veces con
 *   espera creciente y una prueba de un estado de error tardaría segundos en
 *   llegar a él.
 * - `gcTime: 0`, porque el valor por defecto son **cinco minutos** y React Query
 *   programa un temporizador para recoger la caché. Node no termina mientras
 *   quede un temporizador vivo, así que la tanda pasaba en verde y luego se
 *   quedaba colgada: catorce pruebas que suman 350 ms tardaban **305 segundos**
 *   en devolver el control. El número, casi clavado a los 300 000 ms del
 *   `gcTime`, fue lo que lo delató.
 */
export function montar(
  ui: React.ReactElement,
  { locale = 'EN' as Locale }: { locale?: Locale } = {},
): ResultadoMontaje {
  const router = routerFalso();
  const cliente = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });

  const resultado = render(
    <AppRouterContext.Provider value={router}>
      <QueryClientProvider client={cliente}>
        <LocaleProvider locale={locale}>
          <TooltipProvider>{ui}</TooltipProvider>
        </LocaleProvider>
      </QueryClientProvider>
    </AppRouterContext.Provider>,
  );

  return Object.assign(resultado, { router });
}

// ---------------------------------------------------------------------------
// Texto hostil
// ---------------------------------------------------------------------------

/**
 * Cargas por debajo de 40 caracteres, que es el campo más corto de la
 * aplicación (`displayName` y `nickname`).
 *
 * El límite viene de una lección ya pagada en `tests/e2e/xss-surfaces.mjs`: allí
 * la primera versión llevaba un iframe de 44 y los campos cortos lo rechazaban
 * por longitud, lo que yo leía como saneado. Aquí no hay validación de por
 * medio, pero se mantiene el mismo juego para que las dos capas ataquen con lo
 * mismo y se puedan comparar.
 */
export const CARGAS_HOSTILES: Array<[etiqueta: string, carga: string]> = [
  ['etiqueta script', '<script>alert(1)</script>'],
  ['cierre de atributo', '"><img src=x onerror=alert(1)>'],
  ['svg con onload', '<svg/onload=alert(1)>'],
  ['iframe', '<iframe src=//evil.example>'],
  ['comillas y entidades', `&lt;b&gt;'"\`--`],
];

/**
 * Afirma que `carga` llegó al DOM **como texto** y no como marcado.
 *
 * Las dos mitades hacen falta y son distintas:
 *
 * - Que no exista un `<script>`, un `<iframe>` ni un manejador de evento dice
 *   que no se interpretó como HTML.
 * - Que el texto **esté** dice que se pintó. Sin esto, un componente que
 *   devolviera `null` ante cualquier entrada pasaría la primera mitad entera, y
 *   eso es exactamente la forma de prueba que no comprueba nada.
 */
export function assertTextoNoEjecutable(contenedor: HTMLElement, carga: string, donde: string) {
  assert.equal(contenedor.querySelector('script'), null, `${donde}: apareció un <script>`);
  assert.equal(contenedor.querySelector('iframe'), null, `${donde}: apareció un <iframe>`);

  for (const elemento of contenedor.querySelectorAll('*')) {
    for (const atributo of elemento.attributes) {
      assert.ok(
        !/^on/i.test(atributo.name),
        `${donde}: un elemento salió con el atributo ${atributo.name}`,
      );
    }
  }

  assert.ok(
    (contenedor.textContent ?? '').includes(carga),
    `${donde}: el texto no llegó a pintarse, así que no se ha comprobado nada`,
  );
}

/** Los esquemas que nunca deben acabar en un `href` o un `src`. */
export const ESQUEMAS_PROHIBIDOS = /^\s*(javascript|vbscript):|^\s*data:text\/html/i;

/**
 * Recorre **todos** los atributos de todos los elementos buscando un esquema
 * ejecutable.
 *
 * Mirar un solo elemento no vale, y esto se aprendió fallando: la primera
 * versión comprobaba `container.querySelector('img')?.getAttribute('src')` en
 * el avatar. Radix no pinta el `<img>` hasta que la imagen **carga**, y una URL
 * `javascript:` no carga nunca — así que el selector devolvía `null`, la
 * aserción comparaba la cadena vacía y la prueba pasaba **sin haber mirado
 * nada**. Verde por ausencia, que es la peor clase de verde.
 */
export function assertNingunaUrlEjecutable(contenedor: HTMLElement, donde: string) {
  for (const elemento of contenedor.querySelectorAll('*')) {
    for (const atributo of elemento.attributes) {
      assert.ok(
        !ESQUEMAS_PROHIBIDOS.test(atributo.value),
        `${donde}: <${elemento.tagName.toLowerCase()} ${atributo.name}> lleva ${atributo.value}`,
      );
    }
  }
}
