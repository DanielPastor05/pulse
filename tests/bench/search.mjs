/**
 * Latency benchmark for global search.
 *
 * Search fans out over every conversation the viewer belongs to, so its cost is
 * a function of membership count rather than of the query. This seeds an account
 * with a configurable number of matching conversations, then samples the
 * endpoint enough times to report percentiles rather than a single number that
 * any one slow round trip would dominate.
 *
 *   node tests/bench/search.mjs                    # against localhost
 *   E2E_APP_URL=https://… node tests/bench/search.mjs
 *   BENCH_CONVERSATIONS=40 BENCH_SAMPLES=30 node tests/bench/search.mjs
 */
import { makeUser, onboard, api, cleanup, APP } from '../e2e/harness.mjs';

const CONVERSATIONS = Number(process.env.BENCH_CONVERSATIONS ?? 20);
const SAMPLES = Number(process.env.BENCH_SAMPLES ?? 25);
const TOKEN = 'quasar';

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

console.log(`banco de búsqueda -> ${APP}`);
console.log(`conversaciones: ${CONVERSATIONS} · muestras: ${SAMPLES}\n`);

const user = await makeUser('bench');
await onboard(user);

process.stdout.write('sembrando');
for (let i = 0; i < CONVERSATIONS; i += 1) {
  const created = await api('/api/conversations', {
    method: 'POST',
    actor: user,
    body: { name: `${TOKEN} ${i}`, accent: 'electric', memberIds: [] },
  });
  if (created.status >= 400) {
    console.log(`\nno se pudo crear la conversación ${i}: ${created.status}`);
    await cleanup();
    process.exit(1);
  }
  // One message each, so the summary has a last message to resolve — the
  // realistic shape, and the part that makes the per-result query expensive.
  const conversationId = (created.json?.conversation ?? created.json)?.id;
  await api(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    actor: user,
    body: { content: `mensaje de ${TOKEN}`, attachments: [], clientId: `bench-${i}` },
  });
  process.stdout.write('.');
}
console.log('\n');

// One warm-up round so connection setup and plan caching do not land in the
// sample set as a fake outlier.
await api(`/api/search?q=${TOKEN}`, { actor: user });

const timings = [];
let matched = 0;
for (let i = 0; i < SAMPLES; i += 1) {
  const started = performance.now();
  const result = await api(`/api/search?q=${TOKEN}`, { actor: user });
  const elapsed = performance.now() - started;

  if (result.status === 429) {
    console.log('límite de tasa alcanzado; se detiene el muestreo aquí');
    break;
  }
  if (result.status >= 400) {
    console.log(`la búsqueda falló: ${result.status}`);
    break;
  }

  matched = result.json?.conversations?.length ?? 0;
  timings.push(elapsed);
}

timings.sort((a, b) => a - b);
const mean = timings.reduce((total, value) => total + value, 0) / (timings.length || 1);

console.log(`muestras válidas   -> ${timings.length}`);
console.log(`conversaciones que devuelve -> ${matched}`);
console.log(`media              -> ${mean.toFixed(1)} ms`);
console.log(`p50                -> ${percentile(timings, 50).toFixed(1)} ms`);
console.log(`p95                -> ${percentile(timings, 95).toFixed(1)} ms`);
console.log(`p99                -> ${percentile(timings, 99).toFixed(1)} ms`);

await cleanup();
