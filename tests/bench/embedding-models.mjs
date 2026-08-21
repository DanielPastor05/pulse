/**
 * Dos modelos de embeddings, la misma verdad de referencia.
 *
 *   node tests/bench/embedding-models.mjs
 *
 * Deliberadamente **sin base de datos y sin la aplicación**. Lo que se quiere
 * saber es si cambiar de modelo mejora la recuperación, y meter de por medio el
 * índice HNSW, la fusión RRF y la rama léxica mezcla cuatro variables en un
 * número. Aquí sólo se mide coseno contra el corpus en memoria: si el modelo
 * nuevo no gana en estas condiciones limpias, no va a ganar con más piezas
 * encima, y no hay migración que justificar.
 *
 * `gte-small` corre gratis dentro de una Edge Function de Supabase; `bge-m3`
 * corre en Workers AI de Cloudflare y cuesta 1075 neuronas por millón de tokens
 * de entrada, con 10 000 gratis al día. Una pasada entera de este banco son
 * unas 0,01 neuronas.
 */
import { readFileSync } from 'node:fs';

import { CORPUS, DISTRACTORS, QUERIES, distractorText } from './corpus.mjs';

/**
 * Los distractores no son decoración.
 *
 * La primera pasada de este banco midió sólo contra los 28 mensajes
 * etiquetados y dio a `gte-small` un 100% en identificadores opacos —
 * imposible para un embedding, que por definición no representa «7f3a91c».
 * Con 28 candidatos el top-5 es el 18% del corpus y entra casi cualquier cosa:
 * el número no medía el modelo, medía lo pequeño que era el montón. Es el mismo
 * error que `search-quality.mjs` ya documenta haber cometido.
 */
const HAYSTACK = [...CORPUS, ...Array.from({ length: DISTRACTORS }, (_, i) => distractorText(i))];

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const K = 5;

const MODELS = [
  {
    name: 'gte-small',
    where: 'Supabase Edge Function',
    dims: 384,
    async embed(texts) {
      const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/embed`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ input: texts }),
      });
      if (!response.ok) throw new Error(`embed -> ${response.status} ${await response.text()}`);
      return (await response.json()).embeddings;
    },
  },
  {
    name: 'bge-m3',
    where: 'Cloudflare Workers AI',
    dims: 1024,
    async embed(texts) {
      const url = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/baai/bge-m3`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${env.CLOUDFLARE_AI_TOKEN}`,
        },
        body: JSON.stringify({ text: texts }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(`bge-m3 -> ${response.status} ${JSON.stringify(body.errors ?? body)}`);
      }
      return body.result.data ?? body.result.response;
    },
  },
];

/**
 * En lotes, porque las dos funciones tienen techo de recursos por invocación y
 * el corpus entero de una vez devuelve 546 en la de Supabase.
 */
async function embedAll(model, texts, size = 8) {
  const out = [];
  for (let i = 0; i < texts.length; i += size) {
    out.push(...(await model.embed(texts.slice(i, i + size))));
  }
  return out;
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / Math.sqrt(na) / Math.sqrt(nb);
}

/** Posición (1-indexada) del mensaje correcto, o null si no entra en el top-K. */
function rankOf(queryVector, corpusVectors, expected) {
  const ranked = corpusVectors
    .map((vector, index) => ({ index, score: cosine(queryVector, vector) }))
    .sort((a, b) => b.score - a.score);

  const at = ranked.findIndex((row) => row.index === expected);
  return at === -1 || at >= K ? null : at + 1;
}

function pct(n, total) {
  return total === 0 ? '   —' : `${Math.round((n / total) * 100)}%`.padStart(4);
}

async function main() {
  const missing = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_AI_TOKEN']
    .filter((key) => !env[key]);
  if (missing.length) {
    console.error(`Faltan en .env: ${missing.join(', ')}`);
    process.exit(1);
  }

  const buckets = [...new Set(QUERIES.map((q) => q.lang))];
  const results = [];

  for (const model of MODELS) {
    process.stderr.write(`embebiendo ${HAYSTACK.length} textos con ${model.name}…\n`);
    const corpusVectors = await embedAll(model, HAYSTACK);
    const queryVectors = await embedAll(model, QUERIES.map((q) => q.q));

    if (corpusVectors[0].length !== model.dims) {
      throw new Error(`${model.name} devolvió ${corpusVectors[0].length} dimensiones, se esperaban ${model.dims}`);
    }

    const ranks = QUERIES.map((query, i) => rankOf(queryVectors[i], corpusVectors, query.expect));
    results.push({ model, ranks });
  }

  console.log(`\nRecall@${K} y MRR: ${QUERIES.length} consultas etiquetadas contra ${HAYSTACK.length} mensajes`);
  console.log(`(${CORPUS.length} del corpus con verdad de referencia + ${DISTRACTORS} distractores de temas vecinos).`);
  console.log('El corpus está en inglés: las consultas «es» miden recuperación translingüe.\n');

  const header = ['modelo'.padEnd(11), 'dims'.padStart(5), 'total'.padStart(6), ...buckets.map((b) => b.padStart(7))];
  console.log(header.join(' │ '));
  console.log('─'.repeat(header.join(' │ ').length));

  for (const { model, ranks } of results) {
    const hits = ranks.filter(Boolean).length;
    const row = [
      model.name.padEnd(11),
      String(model.dims).padStart(5),
      pct(hits, QUERIES.length).padStart(6),
      ...buckets.map((bucket) => {
        const idx = QUERIES.map((q, i) => (q.lang === bucket ? i : -1)).filter((i) => i >= 0);
        return pct(idx.filter((i) => ranks[i]).length, idx.length).padStart(7);
      }),
    ];
    console.log(row.join(' │ '));
  }

  console.log('\nMRR (1/posición del correcto, 0 si no entra en el top-5):');
  for (const { model, ranks } of results) {
    const mrr = ranks.reduce((sum, rank) => sum + (rank ? 1 / rank : 0), 0) / ranks.length;
    console.log(`  ${model.name.padEnd(11)} ${mrr.toFixed(3)}   (${model.where})`);
  }

  // Qué consultas cambian de resultado. Es lo único que dice *por qué* se mueve
  // el porcentaje, y sin ello dos números distintos no explican nada.
  const [a, b] = results;
  const moved = QUERIES.map((query, i) => ({ query, before: a.ranks[i], after: b.ranks[i] }))
    .filter((row) => Boolean(row.before) !== Boolean(row.after));

  if (moved.length) {
    console.log(`\nConsultas que cambian entre ${a.model.name} y ${b.model.name}:`);
    for (const { query, before, after } of moved) {
      console.log(`  ${after ? '+' : '−'} [${query.lang}] «${query.q}» — ${before ? `puesto ${before}` : 'fuera'} → ${after ? `puesto ${after}` : 'fuera'}`);
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
