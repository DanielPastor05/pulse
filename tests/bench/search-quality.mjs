/**
 * Calidad de recuperación: léxica, vectorial e híbrida.
 *
 * El banco de latencia dice lo rápido que responde la búsqueda. Este dice si
 * encuentra lo correcto, que es la otra mitad y la que justifica haber añadido
 * una segunda rama.
 *
 *   E2E_APP_URL=https://… node tests/bench/search-quality.mjs
 *
 * Cómo funciona: siembra un corpus con verdad de referencia etiquetada a mano
 * —cada consulta sabe qué mensaje debería salir—, espera a que se generen los
 * embeddings por el camino real, y mide las tres configuraciones.
 *
 * La híbrida se mide **a través del endpoint**, no reimplementando la fusión
 * aquí: un banco que replica la lógica que evalúa mide su propia copia. Las
 * otras dos ramas sí van por SQL, porque la aplicación no las expone por
 * separado y añadir un parámetro de depuración a producción para poder medir
 * sería peor que esto.
 *
 * Se publican las tres filas. Que la vectorial sola sea peor en términos
 * exactos es el resultado que justifica la fusión: sin esa fila la tabla parece
 * publicidad.
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

import { api, APP, cleanup, makeUser, onboard, requireServer } from '../e2e/harness.mjs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const prisma = new PrismaClient();
const EMBED_URL = `${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/embed`;
const K = 5;

/**
 * Mensajes de relleno sobre temas vecinos.
 *
 * La primera versión de este banco medía sobre 25 mensajes y daba híbrida
 * exactamente igual que vectorial: con un corpus así, el top-5 es el 20% del
 * total y casi cualquier cosa entra, de modo que la rama léxica nunca llegaba a
 * aportar nada propio. El número no decía que la fusión sobrara — decía que el
 * banco no distinguía.
 *
 * Los distractores son de temas **cercanos** a propósito. Ruido aleatorio no
 * estresa un ranking; lo que lo estresa es que haya veinte mensajes plausibles
 * hablando de latencia cuando buscas un identificador concreto.
 */
const DISTRACTORS = 175;

/**
 * El corpus. Conversación de equipo verosímil, y a propósito **no** escrita
 * como las consultas: si el mensaje repitiera las palabras de la pregunta, la
 * rama léxica ganaría sola y el banco no mediría nada.
 */
const CORPUS = [
  'Pushed the new message grouping — consecutive messages from one person collapse into a single block.',
  'Much calmer to read. Does it still split the block when a few minutes pass between messages?',
  'Five minutes, the same rule the timestamp separator already uses.',
  'Heads up: p50 was six seconds, not three hundred milliseconds. The functions were running in Washington and the database sits in Frankfurt.',
  'Pinned the region to fra1 and it dropped to 314 ms.',
  'That is the figure we put in the README, with the benchmark committed next to it.',
  'The badge on the sidebar was counting the messages you wrote yourself.',
  'Fixed this morning, and there is an integration test so it cannot come back.',
  'The list is role="log" with aria-live polite, so VoiceOver announces new lines without cutting you off.',
  'Every accent colour is darkened until it clears contrast on paper, otherwise light mode washes out.',
  'Voice notes record to WebM, which older iPhones refuse to produce.',
  'The offline queue keeps what you typed with no signal and flushes it when the network returns.',
  'Two people tapping different options of the same poll both got counted before the unique index.',
  'Deleting an account now removes the files too, not just the rows.',
  'A CDN copy can outlive the delete for a short window, which we wrote down rather than hid.',
  'Rate limiting moved out of process memory into Postgres, because each instance had its own counter.',
  'Link previews resolve the first URL, and refuse anything that resolves to a private address.',
  'Group calls are capped at four on video because everyone uploads their camera to everyone else.',
  'Without a relay the connection fails on most mobile networks and it looks like it simply never connects.',
  'The cursor carries the id as well as the timestamp, or pagination walks a different order than the screen.',
  'Twelve messages sharing a millisecond used to make the second page repeat a row.',
  'Migrations run against an empty database in CI, which is how we caught the missing extension.',
  'The scheduled job clears files nobody points at any more, including avatars nobody replaced.',
  'Broadcast failures were invisible until they started going to the error tracker as warnings.',
  'Nothing in the error payload contains message bodies; there is a test that inspects the envelope.',

  // Tokens que un embedding no puede representar: no significan nada, sólo
  // identifican. Aquí es donde la rama léxica tiene que ganar, o no vale su
  // sitio. La primera versión de este banco no los tenía y por eso concluía que
  // la fusión sobraba.
  'The failing job is 7f3a91c and it only breaks on the retry path, never on the first attempt.',
  'Ana Valdes reported it from her Pixel; the desktop build never showed the problem.',
  'It came back as P2002 on the unique index, which is a conflict and not a validation problem.',
];

/** `q` es lo que escribe una persona; `expect` el índice del mensaje correcto. */
const QUERIES = [
  { q: 'the thing about the server being slow', expect: 3, lang: 'en' },
  { q: 'why did we pick that datacentre', expect: 4, lang: 'en' },
  { q: 'unread badge counting my own messages', expect: 6, lang: 'en' },
  { q: 'screen reader announcements', expect: 8, lang: 'en' },
  { q: 'colours washed out in light mode', expect: 9, lang: 'en' },
  { q: 'typing with no internet connection', expect: 11, lang: 'en' },
  { q: 'two people voting at the same time', expect: 12, lang: 'en' },
  { q: 'what happens to my photos when I leave', expect: 13, lang: 'en' },
  { q: 'too many requests from one person', expect: 15, lang: 'en' },
  { q: 'how many people fit in a video call', expect: 17, lang: 'en' },
  { q: 'pagination repeating rows', expect: 20, lang: 'en' },
  { q: 'privacy of what we send to the error tracker', expect: 24, lang: 'en' },

  // Términos exactos: identificadores y nombres propios. Es donde el vector
  // debería perder y el léxico ganar, y por lo que existe la fusión.
  { q: 'fra1', expect: 4, lang: 'exact' },
  { q: 'Frankfurt', expect: 3, lang: 'exact' },
  { q: 'WebM', expect: 10, lang: 'exact' },
  { q: 'aria-live', expect: 8, lang: 'exact' },
  { q: '7f3a91c', expect: 25, lang: 'opaque' },
  { q: 'Valdes', expect: 26, lang: 'opaque' },
  { q: 'P2002', expect: 27, lang: 'opaque' },

  // Español contra corpus en inglés: recuperación translingüe, que gte-small no
  // sabe hacer. Se mide igual, y el número se publica aunque sea malo.
  { q: 'lo del servidor que iba lento', expect: 3, lang: 'es' },
  { q: 'el contador de no leidos estaba mal', expect: 6, lang: 'es' },
  { q: 'accesibilidad para lectores de pantalla', expect: 8, lang: 'es' },
  { q: 'cuantos caben en una videollamada', expect: 17, lang: 'es' },
];

async function embedBatch(texts) {
  const response = await fetch(EMBED_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ input: texts }),
  });
  if (!response.ok) throw new Error(`embed -> ${response.status} ${await response.text()}`);
  return (await response.json()).embeddings;
}

async function embed(text) {
  const response = await fetch(EMBED_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ input: text }),
  });
  if (!response.ok) throw new Error(`embed -> ${response.status}`);
  return (await response.json()).embeddings[0];
}

function prefixQuery(query) {
  const terms = query.split(/[^\p{L}\p{N}_]+/u).filter(Boolean);
  return terms.length > 0 ? terms.map((term) => `${term}:*`).join(' & ') : null;
}

async function lexicalIds(viewerId, query, limit) {
  const tsquery = prefixQuery(query);
  if (!tsquery) return [];
  const rows = await prisma.$queryRaw`
    SELECT m."id"::text AS id
      FROM "messages" m
     WHERE m."searchVector" @@ to_tsquery('simple', ${tsquery})
       AND m."deletedAt" IS NULL AND m."kind" = 'TEXT'
       AND EXISTS (SELECT 1 FROM "conversation_members" cm
                    WHERE cm."conversationId" = m."conversationId" AND cm."userId" = ${viewerId}::uuid)
     ORDER BY ts_rank(m."searchVector", to_tsquery('simple', ${tsquery})) DESC, m."id" DESC
     LIMIT ${limit}`;
  return rows.map((row) => row.id);
}

async function vectorIds(viewerId, query, limit) {
  const literal = `[${(await embed(query)).join(',')}]`;
  const rows = await prisma.$queryRaw`
    SELECT m."id"::text AS id
      FROM "messages" m
     WHERE m."embedding" IS NOT NULL
       AND m."deletedAt" IS NULL AND m."kind" = 'TEXT'
       AND EXISTS (SELECT 1 FROM "conversation_members" cm
                    WHERE cm."conversationId" = m."conversationId" AND cm."userId" = ${viewerId}::uuid)
     ORDER BY m."embedding" <=> ${literal}::vector
     LIMIT ${limit}`;
  return rows.map((row) => row.id);
}

async function hybridIds(user, query) {
  const response = await api(`/api/search?q=${encodeURIComponent(query)}&scope=messages`, {
    actor: user,
  });
  return (response.json?.messages ?? []).map((row) => row.message.id);
}

/** Frases de relleno sobre los mismos temas, para que el ranking tenga que elegir. */
function distractorText(index) {
  const temas = [
    'the deploy pipeline rebuilt the container twice for the same commit',
    'someone asked whether the sidebar should collapse on narrow screens',
    'we should probably document the retry policy before anyone else touches it',
    'latency looked fine locally and only got bad once it was behind the proxy',
    'the staging database drifted from the schema again after the last merge',
    'nobody could reproduce it until we turned the log level up',
    'the picker keeps focus after you choose, which felt wrong in testing',
    'we moved the counter query into the same round trip as the listing',
    'the export takes long enough that it needs a progress indicator',
    'timestamps rendered in the wrong timezone for anyone outside Europe',
    'the placeholder flashes before the real content arrives on slow connections',
    'a stale cache entry survived the deploy and served the old layout',
  ];
  return `${temas[index % temas.length]} (note ${index})`;
}

/**
 * 1 si el correcto está entre los K primeros.
 *
 * `target` se comprueba a propósito: si el mensaje de referencia no llegó a
 * existir, `undefined` casaría con `ids[0]` de cualquier lista vacía y el banco
 * se daría la razón a sí mismo.
 */
const hit = (ids, target) => (target && ids.slice(0, K).includes(target) ? 1 : 0);
/** El más exigente: sólo cuenta si es el primero. */
const top1 = (ids, target) => (target && ids[0] === target ? 1 : 0);
/** 1/posición, o 0 si no aparece. Castiga estar «casi» arriba menos que el recall. */
const reciprocal = (ids, target) => {
  const at = ids.indexOf(target);
  return at === -1 ? 0 : 1 / (at + 1);
};

// --- Montaje -----------------------------------------------------------------

await requireServer();
console.log(`\nbanco de calidad -> ${APP}`);
console.log(`corpus: ${CORPUS.length} mensajes · consultas: ${QUERIES.length} · K = ${K}\n`);

const user = await makeUser('quality');
await onboard(user);

const conversation = await api('/api/conversations', {
  method: 'POST',
  actor: user,
  body: { name: 'Quality corpus', accent: 'electric', memberIds: [] },
});
const conversationId = (conversation.json?.conversation ?? conversation.json)?.id;
if (!conversationId) {
  console.log('no se pudo crear la conversación');
  await cleanup();
  process.exit(1);
}

process.stdout.write('sembrando');
const ids = [];
for (const content of CORPUS) {
  // El limitador acepta 25 envíos por 10 s. Sin esta pausa los mensajes a
  // partir del 25 se van en 429 y sus ids quedan `undefined` — y entonces el
  // banco mide contra un objetivo que no existe y lo cuenta como acierto en
  // toda lista vacía. Pasó, y se vio porque recall@1 salió mayor que recall@5,
  // que es aritméticamente imposible.
  if (ids.length > 0 && ids.length % 20 === 0) {
    await new Promise((resolve) => setTimeout(resolve, 10_500));
  }

  const sent = await api(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    actor: user,
    body: { content, clientId: `quality-${ids.length}` },
  });

  const id = (sent.json?.message ?? sent.json)?.id;
  if (!id) {
    console.log(`\nno se pudo sembrar el mensaje ${ids.length}: ${sent.status}`);
    await prisma.$disconnect();
    await cleanup();
    process.exit(1);
  }

  ids.push(id);
  process.stdout.write('.');
}
console.log('');

// Los distractores entran por SQL y con embeddings en lote, no por el endpoint.
// Doscientos mensajes por la API tardarían minutos contra el limitador de
// envíos, y aquí no son el objeto de la medición: son el ruido contra el que se
// mide. Lo que se evalúa sí pasó por el camino real.
process.stdout.write('sembrando distractores');
for (let base = 0; base < DISTRACTORS; base += 8) {
  const textos = Array.from({ length: Math.min(8, DISTRACTORS - base) }, (_, i) =>
    distractorText(base + i),
  );
  const vectores = await embedBatch(textos);

  await prisma.$transaction(
    textos.map(
      (content, i) => prisma.$executeRaw`
        INSERT INTO "messages" ("id", "conversationId", "authorId", "kind", "content", "embedding", "createdAt")
        VALUES (gen_random_uuid(), ${conversationId}::uuid, ${user.id}::uuid, 'TEXT', ${content},
                ${`[${vectores[i].join(',')}]`}::vector, now())`,
    ),
  );
  process.stdout.write('.');
}
console.log('');

// Los embeddings se generan fuera de la respuesta, así que hay que esperarlos.
// Se sondea en vez de dormir un rato fijo: dormir de más alarga el banco y
// dormir de menos mide un índice a medio construir, que es peor.
process.stdout.write('esperando embeddings');
for (let intento = 0; intento < 60; intento += 1) {
  const [{ pending }] = await prisma.$queryRaw`
    SELECT count(*)::int AS pending FROM "messages"
     WHERE "conversationId" = ${conversationId}::uuid AND "embedding" IS NULL`;
  if (pending === 0) break;
  process.stdout.write('.');
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
console.log('');

// --- Medición ----------------------------------------------------------------

const arms = { lexical: [], vector: [], hybrid: [] };
const byLang = {};

for (const { q, expect, lang } of QUERIES) {
  const target = ids[expect];
  const [lexical, vector, hybrid] = [
    await lexicalIds(user.id, q, 50),
    await vectorIds(user.id, q, 50),
    await hybridIds(user, q),
  ];

  const row = {
    q,
    lang,
    lexical: { hit: hit(lexical, target), top1: top1(lexical, target), mrr: reciprocal(lexical, target) },
    vector: { hit: hit(vector, target), top1: top1(vector, target), mrr: reciprocal(vector, target) },
    hybrid: { hit: hit(hybrid, target), top1: top1(hybrid, target), mrr: reciprocal(hybrid, target) },
  };

  for (const arm of ['lexical', 'vector', 'hybrid']) arms[arm].push(row[arm]);
  (byLang[lang] ??= []).push(row);

  const mark = (value) => (value.hit ? ' ok ' : ' -- ');
  console.log(
    `  ${lang.padEnd(6)}${mark(row.lexical)}${mark(row.vector)}${mark(row.hybrid)}  «${q}»`,
  );
}

function summarise(rows) {
  const recall = rows.reduce((sum, row) => sum + row.hit, 0) / rows.length;
  const primero = rows.reduce((sum, row) => sum + row.top1, 0) / rows.length;
  const mrr = rows.reduce((sum, row) => sum + row.mrr, 0) / rows.length;
  return {
    recall: (recall * 100).toFixed(0),
    top1: (primero * 100).toFixed(0),
    mrr: mrr.toFixed(3),
  };
}

console.log(`\n  ${''.padEnd(12)}recall@1   recall@${K}   MRR`);
for (const arm of ['lexical', 'vector', 'hybrid']) {
  const { recall, top1: primero, mrr } = summarise(arms[arm]);
  console.log(
    `  ${arm.padEnd(12)}${String(primero).padStart(4)}%       ${String(recall).padStart(4)}%    ${mrr}`,
  );
}

console.log('\n  por tipo de consulta (recall@' + K + '):');
console.log(`  ${''.padEnd(8)}lexical  vector  hybrid`);
for (const [lang, rows] of Object.entries(byLang)) {
  const cell = (arm) => `${summarise(rows.map((row) => row[arm])).recall}%`.padStart(6);
  console.log(`  ${lang.padEnd(8)}${cell('lexical')}  ${cell('vector')}  ${cell('hybrid')}`);
}

await prisma.$disconnect();
await cleanup();
