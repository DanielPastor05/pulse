/**
 * Carga hostil en cada campo de texto y de URL que escribe una persona.
 *
 *   E2E_APP_URL=https://… node tests/e2e/xss-surfaces.mjs
 *
 * `tests/component/xss.test.tsx` ya ataca el renderizador de mensajes, que es la
 * superficie grande. Faltaban las pequeñas — nombre, biografía, estado, nombre
 * de grupo, descripción, apodo— y sobre todo las que **no son texto**: un
 * `avatarUrl` acaba dentro de un `src`, así que ahí un `javascript:` no es texto
 * feo, es ejecución.
 *
 * El argumento de que están bien existe y es bueno: React escapa los nodos de
 * texto por construcción, y `httpUrl` en `src/lib/zod.ts` rechaza todo lo que no
 * sea http(s) precisamente porque `z.string().url()` acepta `javascript:`. Pero
 * ese argumento nunca se había ejecutado contra el servidor. Esto lo ejecuta.
 *
 * Dos afirmaciones distintas, y conviene no confundirlas:
 *
 * - En los campos de **texto** la carga debe **guardarse tal cual**. Que vuelva
 *   idéntica es lo correcto: el escapado es cosa de quien pinta, no de quien
 *   guarda. Un servidor que devolviera el texto a medio limpiar sería peor —
 *   daría una falsa sensación de saneado y rompería nombres legítimos con `<`.
 * - En los campos de **URL** la carga debe **rechazarse**, porque ahí no hay
 *   ningún momento posterior en el que escapar salve nada.
 */
import { api, check, cleanup, makeUser, onboard, requireServer } from './harness.mjs';

await requireServer();

/*
 * Todas por debajo de 40 caracteres, que es el campo más corto de los que se
 * prueban (`displayName` y `nickname`).
 *
 * No es un detalle de estilo. La primera versión llevaba un iframe de 44 y los
 * dos campos cortos lo rechazaban con un 400 — el límite de longitud haciendo su
 * trabajo, que yo estaba leyendo como «el servidor rechaza la carga hostil». Es
 * el mismo error que ya se cometió en la auditoría con los cuerpos inválidos:
 * una carga que no cabe no prueba nada sobre el saneado, porque nunca llega a
 * la parte que se quiere mirar.
 */
const CARGAS = [
  ['etiqueta script', '<script>alert(1)</script>'],
  ['cierre de atributo', '"><img src=x onerror=alert(1)>'],
  ['svg con onload', '<svg/onload=alert(1)>'],
  ['iframe', '<iframe src=//evil.example>'],
  ['comillas y entidades', `&lt;b&gt;'"\`--`],
];

for (const [nombre, carga] of CARGAS) {
  if (carga.length > 40) throw new Error(`la carga «${nombre}» mide ${carga.length}, no cabe en displayName`);
}

const URLS_MALAS = [
  ['javascript:', 'javascript:alert(document.cookie)'],
  ['data: con html', 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='],
  ['vbscript:', 'vbscript:msgbox(1)'],
  ['javascript: con mayúsculas', 'JaVaScRiPt:alert(1)'],
  ['con espacio delante', ' javascript:alert(1)'],
];

console.log('\npreparando…');
const alice = await makeUser('alice');
const bob = await makeUser('bob');
await onboard(alice);
await onboard(bob);

const grupo = await api('/api/conversations', {
  actor: alice,
  method: 'POST',
  body: { type: 'GROUP', name: 'Superficies', memberIds: [bob.id] },
});
const grupoId = grupo.json?.id ?? grupo.json?.conversation?.id;
check('el grupo se crea', grupo.status, 201);

// ---------------------------------------------------------------------------
// 1. Campos de texto: entra hostil, sale idéntico
// ---------------------------------------------------------------------------
console.log('\nel texto hostil se guarda como texto, sin tocar:');

/** Escribe `valor` en `campo` y lo lee de vuelta por otra ruta. */
async function idaYVuelta(etiqueta, escribir, leer) {
  for (const [nombreCarga, carga] of CARGAS) {
    const puesto = await escribir(carga);
    if (puesto.status >= 400) {
      console.log(`  FAIL  ${etiqueta} · ${nombreCarga} -> rechazado ${puesto.status}`);
      process.exitCode = 1;
      continue;
    }

    const vuelta = await leer();
    const ok = vuelta === carga;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${etiqueta} · ${nombreCarga}`);
    if (!ok) {
      process.exitCode = 1;
      console.log(`        guardó: ${JSON.stringify(vuelta)?.slice(0, 120)}`);
    }
  }
}

const mio = async () => (await api('/api/me', { actor: alice })).json;

await idaYVuelta(
  'displayName',
  (v) => api('/api/me', { actor: alice, method: 'PATCH', body: { displayName: v } }),
  async () => (await mio())?.user?.displayName ?? (await mio())?.displayName,
);

await idaYVuelta(
  'bio',
  (v) => api('/api/me', { actor: alice, method: 'PATCH', body: { bio: v } }),
  async () => (await mio())?.user?.bio ?? (await mio())?.bio,
);

await idaYVuelta(
  'statusText',
  (v) => api('/api/me', { actor: alice, method: 'PATCH', body: { statusText: v } }),
  async () => (await mio())?.user?.statusText ?? (await mio())?.statusText,
);

const detalle = async () => (await api(`/api/conversations/${grupoId}`, { actor: alice })).json;

await idaYVuelta(
  'nombre de grupo',
  (v) => api(`/api/conversations/${grupoId}`, { actor: alice, method: 'PATCH', body: { name: v } }),
  async () => (await detalle())?.name,
);

await idaYVuelta(
  'descripción de grupo',
  (v) =>
    api(`/api/conversations/${grupoId}`, { actor: alice, method: 'PATCH', body: { description: v } }),
  async () => (await detalle())?.description,
);

await idaYVuelta(
  'apodo de miembro',
  (v) =>
    api(`/api/conversations/${grupoId}/members/${bob.id}`, {
      actor: alice,
      method: 'PATCH',
      body: { nickname: v },
    }),
  async () => (await detalle())?.members?.find((m) => m.user?.id === bob.id)?.nickname,
);

// ---------------------------------------------------------------------------
// 2. El nombre de usuario es la excepción: ahí sí se rechaza
// ---------------------------------------------------------------------------
// Va en la URL del perfil, así que su esquema es una lista blanca estrecha
// (`^[a-z0-9_]+$`). Aquí lo correcto es el 400, no el guardado literal.
console.log('\nel nombre de usuario rechaza todo lo que no sea su alfabeto:');

for (const [nombreCarga, carga] of CARGAS) {
  const r = await api('/api/me', { actor: alice, method: 'PATCH', body: { username: carga } });
  const ok = r.status === 400;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${nombreCarga} -> ${r.status}`);
  if (!ok) process.exitCode = 1;
}

// ---------------------------------------------------------------------------
// 3. Campos de URL: lo que acaba en un src o un href
// ---------------------------------------------------------------------------
console.log('\nlas URL con esquema ejecutable no se guardan:');

const CAMPOS_URL = [
  ['avatar de perfil', (v) => api('/api/me', { actor: alice, method: 'PATCH', body: { avatarUrl: v } })],
  [
    'avatar de grupo',
    (v) => api(`/api/conversations/${grupoId}`, { actor: alice, method: 'PATCH', body: { avatarUrl: v } }),
  ],
];

for (const [campo, escribir] of CAMPOS_URL) {
  for (const [nombreUrl, url] of URLS_MALAS) {
    const r = await escribir(url);
    const ok = r.status === 400;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${campo} · ${nombreUrl} -> ${r.status}`);
    if (!ok) {
      process.exitCode = 1;
      console.log(`        aceptó: ${JSON.stringify(r.json).slice(0, 140)}`);
    }
  }

  // El control positivo: una URL normal sí entra. Sin esto, un campo que
  // rechazara cualquier cosa dejaría los cinco rechazos de arriba en verde.
  const buena = await escribir('https://example.com/avatar.png');
  check(`${campo} · una https normal sí se acepta`, buena.status, 200);
}

// Y el otro control, el que cierra el círculo: lo guardado se lee de vuelta.
const perfil = await mio();
check(
  'el avatar bueno es el que quedó guardado',
  (perfil?.user?.avatarUrl ?? perfil?.avatarUrl),
  'https://example.com/avatar.png',
);

await cleanup();
console.log('\ncuentas de prueba borradas');
