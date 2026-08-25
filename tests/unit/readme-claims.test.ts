import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

/**
 * El README dice cifras sobre este repositorio. Aquí se comprueba que siguen
 * siendo ciertas.
 *
 * El 21/08/2026 se auditó a mano y **siete** se habían quedado atrás: el total
 * de comprobaciones, la cobertura, las políticas de RLS, y tres recuentos de
 * endpoints que además se contradecían entre sí — 46 en un sitio, 51 en otro,
 * y «las dos rutas sin sesión» cuando eran cuatro. Ninguna se rompió de golpe;
 * cada una se quedó atrás el día que alguien añadió una ruta y no volvió a
 * leer la portada.
 *
 * En un documento cuyo argumento entero es «aquí está el número, medido», una
 * cifra desfasada no se lee como un descuido. Se lee como que las demás
 * tampoco están comprobadas.
 *
 * Sólo se cubre lo que se puede saber **leyendo ficheros**. La cobertura y las
 * latencias salen de ejecutar cosas, así que no caben aquí y siguen dependiendo
 * de que alguien las actualice. Eso también está dicho, para que nadie lea esta
 * prueba como una garantía más amplia de la que da.
 */

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));

// Normalizado a `\n`: en Windows el fichero está en CRLF, y un patrón que
// espere `\n### ` no casa nada sin que quede claro por qué.
const readme = readFileSync(join(RAIZ, 'README.md'), 'utf8').replace(/\r\n/g, '\n');

/** Ficheros que terminen en `sufijo`, a cualquier profundidad. */
function ficherosPorExtension(directorio: string, sufijo: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) salida.push(...ficherosPorExtension(ruta, sufijo));
    else if (entrada.name.endsWith(sufijo)) salida.push(ruta);
  }
  return salida;
}

const RUTAS = ficherosPorExtension(join(RAIZ, 'src', 'app', 'api'), 'route.ts');

/**
 * Extrae el primer número que sigue a un texto en el README.
 *
 * Devolver `null` en vez de lanzar deja que la aserción explique qué falta, que
 * es más útil que un error de expresión regular.
 */
function cifraTras(patron: RegExp): number | null {
  const encontrado = readme.match(patron);
  return encontrado?.[1] ? Number(encontrado[1]) : null;
}

test('el total de comprobaciones es la suma de sus sumandos', () => {
  const fila = readme.match(/\*\*Automated checks\*\* \| (\d+) — (.+?) \|/);
  assert.ok(fila, 'no se encontró la fila «Automated checks» en la tabla de portada');

  const total = Number(fila[1]);
  const sumandos = [...fila[2]!.matchAll(/(\d+)\s+[a-z]/g)].map((m) => Number(m[1]));

  assert.ok(sumandos.length >= 4, `sólo se leyeron ${sumandos.length} sumandos en «${fila[2]}»`);
  assert.equal(
    sumandos.reduce((a, b) => a + b, 0),
    total,
    `la portada dice ${total} pero sus sumandos (${sumandos.join(' + ')}) dan otra cosa`,
  );
});

test('el número de pruebas unitarias es el que hay', () => {
  /*
   * Comprobar sólo que el total cuadre con sus sumandos no basta, y esto lo
   * demostró dos veces el mismo día: al añadir pruebas, «52 unit» se quedó
   * atrás mientras la suma seguía siendo internamente coherente. Una cifra
   * puede ser consistente consigo misma y falsa.
   *
   * Se cuentan las declaraciones `test(` a principio de línea. Es un recuento
   * sintáctico, no una ejecución: si alguien anida `test()` dentro de otro o lo
   * indenta, este número se queda corto — y entonces esta prueba avisa de algo
   * que no es. Es el precio de contar sin ejecutar, y por eso está dicho.
   */
  const ficheros = [
    ...ficherosPorExtension(join(RAIZ, 'src'), '.test.ts'),
    ...ficherosPorExtension(join(RAIZ, 'tests', 'unit'), '.test.ts'),
  ];
  const declaradas = ficheros.reduce(
    (suma, ruta) => suma + [...readFileSync(ruta, 'utf8').matchAll(/^test\(/gm)].length,
    0,
  );

  const dicho = cifraTras(/(\d+) unit(?:,| tests)/);
  assert.ok(dicho !== null, 'el README ya no dice cuántas pruebas unitarias hay');
  assert.equal(dicho, declaradas, `el README dice ${dicho} pruebas unitarias y hay ${declaradas}`);
});

/*
 * Las otras tres capas que se pueden contar leyendo.
 *
 * Esto se añadió el 23/08/2026 después de que la cifra de componente se fuera a
 * **más del doble** —el README decía 6 y había 14— sin que nada avisara. El
 * guardián existía desde hacía dos días y cubría sólo las unitarias, así que la
 * lección no fue «hay que comprobar las cifras»: fue que comprobar una sola
 * deja creer que están comprobadas todas.
 *
 * Las de extremo a extremo se quedan fuera y conviene decir por qué: no son
 * declaraciones `test(` sino llamadas dentro de bucles, así que contarlas
 * leyendo daría un número que no es el que sale al ejecutarlas. Esa cifra sigue
 * dependiendo de medirla.
 */
/**
 * Cuenta declaraciones `test(` a principio de línea bajo un directorio.
 *
 * Las tres comprobaciones de abajo están escritas sueltas y no en un bucle a
 * propósito: un `test()` generado dentro de un `for` va indentado, y entonces
 * el recuento sintáctico de esta misma prueba no lo ve. El guardián acabaría
 * exigiendo una cifra en el README que no coincide con la que imprime
 * `npm test`, que es precisamente el desfase que viene a impedir.
 */
function declaradas(directorio: string[], sufijo: string): number {
  return ficherosPorExtension(join(RAIZ, ...directorio), sufijo).reduce(
    (suma, ruta) => suma + [...readFileSync(ruta, 'utf8').matchAll(/^test\(/gm)].length,
    0,
  );
}

function afirmaCapa(nombre: string, patron: RegExp, hay: number) {
  const dicho = cifraTras(patron);
  assert.ok(dicho !== null, `el README ya no dice cuántas pruebas de ${nombre} hay`);
  assert.equal(dicho, hay, `el README dice ${dicho} de ${nombre} y hay ${hay}`);
}

test('el número de pruebas de componente es el que hay', () => {
  afirmaCapa('componente', /(\d+) component/, declaradas(['tests', 'component'], '.test.tsx'));
});

test('el número de pruebas de integración es el que hay', () => {
  afirmaCapa(
    'integración',
    /(\d+) (?:integration|tests against a real Postgres)/,
    declaradas(['tests', 'integration'], '.test.ts'),
  );
});

test('el número de pruebas de navegador es el que hay', () => {
  afirmaCapa('navegador', /(\d+) browser/, declaradas(['tests', 'smoke'], '.spec.ts'));
});

test('el número de ficheros de ruta coincide con los que hay', () => {
  const dicho = cifraTras(/(\d+) route files/);
  assert.ok(dicho !== null, 'el README ya no dice cuántos ficheros de ruta hay');
  assert.equal(dicho, RUTAS.length, `el README dice ${dicho} ficheros de ruta y hay ${RUTAS.length}`);
});

test('el número de endpoints coincide con los métodos HTTP exportados', () => {
  // «Endpoint» es un método HTTP, no un fichero: un `route.ts` puede exportar
  // GET, PATCH y DELETE. Esa distinción es la que se perdió y produjo dos
  // recuentos distintos en el mismo documento.
  const metodos = RUTAS.reduce((suma, ruta) => {
    const fuente = readFileSync(ruta, 'utf8');
    return suma + [...fuente.matchAll(/^export (?:async )?(?:function|const) (?:GET|POST|PATCH|PUT|DELETE)\b/gm)].length;
  }, 0);

  const dicho = cifraTras(/(\d+) endpoints across/);
  assert.ok(dicho !== null, 'el README ya no dice cuántos endpoints hay');
  assert.equal(dicho, metodos, `el README dice ${dicho} endpoints y se exportan ${metodos} métodos`);
});

test('las rutas que no piden sesión son las que el README enumera', () => {
  /*
   * Se cuentan **llamadas**, no menciones, y no es un detalle.
   *
   * Contando menciones, `/api/metrics` parece llamar a `requireUser` — la
   * palabra aparece en un comentario que explica precisamente por qué no lo
   * hace. Ese falso positivo ya costó una conclusión equivocada el mismo día
   * que se escribió esta prueba, y es el tercer error de recuento de este tipo
   * en el proyecto: antes fueron un `[id]` que PowerShell tomó por comodín y
   * un `-SimpleMatch "TODO"` que casó con la palabra española «todo».
   */
  const sinSesion = RUTAS.filter((ruta) => !/await requireUser\(/.test(readFileSync(ruta, 'utf8')));
  const conSesion = RUTAS.length - sinSesion.length;

  /*
   * Sólo la tabla de *esa* sección: la de la API más abajo también lista rutas
   * entre acentos graves, y contarlas todas daba seis donde hay cuatro.
   *
   * El número del título va como grupo y no incrustado. Estaba incrustado —
   * `### The four endpoints…`— y al pasar de cuatro a cinco esta prueba falló
   * diciendo «ya no existe la sección», que es un mensaje que manda a buscar
   * donde no es. Un guardián que se rompe al cambiar justo lo que vigila hace
   * perder el tiempo dos veces.
   */
  const seccion = readme.match(/### The (\w+) endpoints without requireUser\n([\s\S]*?)\n### /);
  assert.ok(seccion, 'ya no existe la sección que enumera las rutas sin sesión');

  const enumeradas = [...seccion[2]!.matchAll(/^\| `(\/api\/[^`]+)` \|/gm)].map((m) => m[1]);

  const EN_LETRA: Record<string, number> = { three: 3, four: 4, five: 5, six: 6, seven: 7 };
  assert.equal(
    EN_LETRA[seccion[1]!.toLowerCase()],
    sinSesion.length,
    `el título dice «${seccion[1]}» y son ${sinSesion.length}`,
  );
  assert.equal(
    enumeradas.length,
    sinSesion.length,
    `el README enumera ${enumeradas.length} rutas sin sesión y hay ${sinSesion.length}: ` +
      sinSesion.map((ruta) => ruta.replace(RAIZ, '')).join(', '),
  );

  // Y el título de esa sección cuenta lo mismo, en letra.
  const NUMEROS: Record<string, number> = {
    'forty-seven': 47, 'forty-eight': 48, 'forty-nine': 49, 'fifty': 50,
    'fifty-one': 51, 'fifty-two': 52, 'fifty-three': 53, 'fifty-four': 54,
    'fifty-five': 55, 'fifty-six': 56,
  };
  const frase = readme.match(/^([A-Z][a-z]+-[a-z]+) of ([a-z]+-[a-z]+) route files call/m);
  assert.ok(frase, 'la sección de endpoints ya no dice «N of M route files call»');
  assert.equal(NUMEROS[frase[1]!.toLowerCase()], conSesion, `«${frase[1]}» ya no son los que llaman a requireUser`);
  assert.equal(NUMEROS[frase[2]!.toLowerCase()], RUTAS.length, `«${frase[2]}» ya no son los ficheros de ruta que hay`);
});

test('todo script que el README enseña existe en package.json', () => {
  const paquete = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  // El `0-9` no sobra: sin él, «test:e2e» se leía como «test:e» y la prueba
  // acusaba al README de inventarse un script que sí existe.
  const enseñados = [...readme.matchAll(/npm run ([a-z0-9:]+)/g)].map((m) => m[1]!);
  const inventados = [...new Set(enseñados)].filter((nombre) => !(nombre in paquete.scripts));

  assert.deepEqual(inventados, [], `el README manda ejecutar scripts que no existen: ${inventados.join(', ')}`);
});
