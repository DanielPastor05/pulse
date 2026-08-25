import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

/**
 * Texto de interfaz que no pasa por el diccionario.
 *
 * Ya hubo un barrido por AST, y encontró trece. Miraba nodos `JsxText` — el
 * texto suelto entre etiquetas— y con eso se dio la traducción por terminada.
 *
 * El 23/08/2026, montando componentes en pruebas por primera vez, apareció
 * «Marta is typing» con la interfaz en español. Buscando por qué, salieron
 * **quince cadenas más** en tres formas que aquel barrido no miraba:
 *
 *   {cond ? 'Unmute' : t.conversation.mute}      literal dentro de {expresión}
 *   emptyDescription="Messages you send here…"   literal como valor de atributo
 *   function describe() { return `${x} is typing` }   literal en una auxiliar
 *
 * La lección no es que faltara una forma: es que **un detector que no encuentra
 * nada se lee como que no hay nada**. Por eso esto vive como prueba y no como
 * script que alguien recuerde ejecutar.
 *
 * Lo que no cubre, dicho para que nadie lo lea como más de lo que es: sólo mira
 * `.tsx` bajo `src`, y decide con heurística qué parece texto para una persona.
 * Una cadena en un `.ts` o una que parezca una clase de CSS se le escapan.
 */

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));

/** Sitios donde una cadena en inglés es correcta y no hay que tocarla. */
const PERMITIDAS = new Set([
  // Nombres de tecla comparados contra `event.key`, no texto.
  'ArrowRight',
  'ArrowLeft',
  'ArrowUp',
  'ArrowDown',
  'Escape',
  'Enter',
  // La marca no se traduce.
  'Pulse',
]);

function ficherosTsx(directorio: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) salida.push(...ficherosTsx(ruta));
    else if (entrada.name.endsWith('.tsx')) salida.push(ruta);
  }
  return salida;
}

/**
 * ¿Parece texto para una persona?
 *
 * La primera versión de esta heurística devolvía 94 candidatos de los que la
 * inmensa mayoría eran clases de Tailwind, comparaciones contra enums y valores
 * de estilo. Un detector con ese ruido no se lee: se hojea, y lo de verdad se
 * pierde entre lo demás. Estos descartes son lo que lo dejó en algo utilizable.
 */
function pareceTexto(valor: string): boolean {
  const v = valor.trim();
  if (v.length < 3) return false;
  if (PERMITIDAS.has(v)) return false;
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(v)) return false;

  // Valores de enum del esquema: una sola palabra en mayúsculas.
  if (/^[A-Z_]+$/.test(v)) return false;

  // Valores y funciones de CSS.
  if (/\b(hsl|rgb|var|env|repeat|minmax|calc|url)\(/.test(v)) return false;
  if (/\d+(rem|px|fr|vh|vw|%|s)\b/.test(v)) return false;

  // Clases de Tailwind: cada trozo con su alfabeto y ninguna palabra normal.
  if (v.split(/\s+/).every((trozo) => /^[a-z0-9:\-[\]./]+$/.test(trozo))) return false;

  // Rutas y variables de CSS.
  if (/^[/#]|^--/.test(v)) return false;

  // Interpolaciones que sólo pegan valores: `· ${nombre}`, `${a}/${b}`.
  if (/^[^A-Za-zÁÉÍÓÚÑáéíóúñ]*\$\{/.test(v) && !/[A-Za-z]{3}/.test(v.replace(/\$\{[^}]*\}/g, '')))
    return false;

  return /^[A-ZÁÉÍÓÚÑ]/.test(v) || v.includes(' ');
}

/** Atributos que nunca llevan texto para una persona. */
const ATRIBUTOS_TECNICOS = new Set([
  'className', 'id', 'type', 'role', 'href', 'src', 'name', 'key', 'as',
  'variant', 'size', 'side', 'align', 'rel', 'target', 'method', 'value',
  'autoComplete', 'inputMode', 'loading', 'width', 'height', 'viewBox',
  'fill', 'stroke', 'd', 'xmlns', 'sizes', 'accept',
]);

type Hallazgo = { fichero: string; linea: number; valor: string; forma: string };

function buscar(): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];

  for (const ruta of ficherosTsx(join(RAIZ, 'src'))) {
    const fuente = ts.createSourceFile(
      ruta,
      readFileSync(ruta, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    const anotar = (nodo: ts.Node, valor: string, forma: string) => {
      if (!pareceTexto(valor)) return;
      const { line } = fuente.getLineAndCharacterOfPosition(nodo.getStart());
      hallazgos.push({
        fichero: ruta.slice(RAIZ.length).replaceAll('\\', '/'),
        linea: line + 1,
        valor: valor.trim().slice(0, 60),
        forma,
      });
    };

    const visitar = (nodo: ts.Node) => {
      if (ts.isJsxExpression(nodo) && nodo.expression) {
        const dentro = (n: ts.Node) => {
          if (ts.isStringLiteral(n)) anotar(n, n.text, 'literal en {expresión}');
          else if (ts.isTemplateExpression(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
            anotar(n, n.getText().replaceAll('`', ''), 'plantilla en {expresión}');
          }
          // Sin entrar en llamadas: `t.algo('x')` y `cn('clase')` son legítimos.
          if (!ts.isCallExpression(n)) ts.forEachChild(n, dentro);
        };
        dentro(nodo.expression);
      }

      if (ts.isJsxAttribute(nodo) && nodo.initializer && ts.isStringLiteral(nodo.initializer)) {
        const nombre = nodo.name.getText();
        if (!ATRIBUTOS_TECNICOS.has(nombre) && !nombre.startsWith('data-')) {
          anotar(nodo.initializer, nodo.initializer.text, `atributo ${nombre}`);
        }
      }

      if (ts.isReturnStatement(nodo) && nodo.expression) {
        const e = nodo.expression;
        if (ts.isStringLiteral(e)) anotar(e, e.text, 'literal devuelto');
        else if (ts.isTemplateExpression(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
          anotar(e, e.getText().replaceAll('`', ''), 'plantilla devuelta');
        }
      }

      ts.forEachChild(nodo, visitar);
    };

    visitar(fuente);
  }

  return hallazgos;
}

/**
 * Los avisos emergentes, que viven en ficheros `.ts` y por eso no los veía nadie.
 *
 * El barrido de arriba sólo recorre `.tsx`, y los `toast.success(...)` están en
 * los hooks. Resultado: **treinta y ocho** mensajes en inglés a pelo, así que la
 * aplicación se veía en español y confirmaba cada acción en inglés. Se reportó
 * como «errores con el español y el inglés», y costó verlo porque no falla nada
 * — simplemente sale en el idioma que no es.
 *
 * Es una regla estrecha a propósito: un literal dentro de `toast.*()` es
 * siempre texto para una persona, sin excepciones ni heurística que afinar.
 */
test('ningún aviso emergente lleva el texto escrito a mano', () => {
  const sospechosos: string[] = [];

  const recorrer = (directorio: string) => {
    for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
      const ruta = join(directorio, entrada.name);
      if (entrada.isDirectory()) {
        recorrer(ruta);
        continue;
      }
      if (!/\.tsx?$/.test(entrada.name) || entrada.name.includes('.test.')) continue;

      const fuente = readFileSync(ruta, 'utf8');

      /*
       * El literal no tiene por qué ir pegado al paréntesis.
       *
       * La primera versión pedía la comilla justo detrás de `toast.x(`, y por
       * eso se le escapó `toast.success(input.blocked ? 'Blocked' : 'Unblocked')`
       * — un ternario con las dos ramas en inglés, encontrado a mano dos horas
       * después de dar la caza por terminada. Ahora se mira el argumento entero
       * hasta el cierre o la primera coma de nivel superior.
       */
      for (const encontrado of fuente.matchAll(
        /toast\.(?:success|error|info|warning)\(([^;]*?)\)[;,\s]/g,
      )) {
        const argumento = encontrado[1] ?? '';

        /*
         * Se juzgan los literales con el mismo criterio que el resto, y no con
         * uno propio.
         *
         * La primera versión pedía sólo «dos letras seguidas», y con eso marcó
         * una línea **ya corregida**: se quejaba de `'RESOLVED'`, el valor de
         * enum con el que se compara el estado de la denuncia. Un detector que
         * acusa a código correcto se desactiva a la semana, así que comparte la
         * heurística que ya sabe distinguir un enum de una frase.
         */
        const literales = [...argumento.matchAll(/(['"`])((?:(?!\1)[^\\])*)\1/g)].map((m) => m[2]!);
        if (!literales.some((texto) => pareceTexto(texto))) continue;

        const linea = fuente.slice(0, encontrado.index).split('\n').length;
        sospechosos.push(`${ruta.slice(RAIZ.length).replaceAll('\\', '/')}:${linea}`);
      }
    }
  };
  recorrer(join(RAIZ, 'src'));

  assert.deepEqual(
    sospechosos,
    [],
    `estos avisos no pasan por el diccionario:\n  ${sospechosos.join('\n  ')}`,
  );
});

test('ninguna cadena de interfaz se salta el diccionario', () => {
  const hallazgos = buscar().filter((h) => !h.fichero.includes('.test.'));

  const detalle = hallazgos
    .map((h) => `  ${h.fichero}:${h.linea}  «${h.valor}»  (${h.forma})`)
    .join('\n');

  assert.equal(
    hallazgos.length,
    0,
    `hay texto que no pasa por el diccionario:\n${detalle}\n\n` +
      'Si alguno es un falso positivo —una clase de CSS, un nombre de tecla—, ' +
      'añádelo a PERMITIDAS o afina `pareceTexto`, con el motivo escrito.',
  );
});

test('el detector encuentra algo cuando lo hay', () => {
  /*
   * El control positivo, y aquí hace más falta que en ninguna otra prueba.
   *
   * La aserción de arriba pasa cuando no encuentra nada, que es exactamente lo
   * que hacía el detector anterior mientras quince cadenas seguían en inglés.
   * Un detector roto y un proyecto bien traducido se ven idénticos desde fuera.
   */
  const casos: Array<[string, string]> = [
    ['literal en {expresión}', "const A = () => <p>{cond ? 'Unmute' : t.x}</p>;"],
    ['atributo', 'const B = () => <Input placeholder="Type a message" />;'],
    ['plantilla devuelta', 'function d(n: string) { return `${n} is typing`; }'],
  ];

  for (const [forma, codigo] of casos) {
    const fuente = ts.createSourceFile('prueba.tsx', codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let encontrado = false;

    const visitar = (nodo: ts.Node) => {
      if (ts.isStringLiteral(nodo) && pareceTexto(nodo.text)) encontrado = true;
      if (ts.isTemplateExpression(nodo) && pareceTexto(nodo.getText().replaceAll('`', ''))) {
        encontrado = true;
      }
      ts.forEachChild(nodo, visitar);
    };
    visitar(fuente);

    assert.ok(encontrado, `el detector no vería un caso de «${forma}»`);
  }
});
