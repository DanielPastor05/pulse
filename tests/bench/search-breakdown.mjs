/**
 * De dónde salen los 434 ms de la búsqueda.
 *
 * El banco de latencia dio 314 ms cuando se arregló la región y 434 ms después
 * de añadir la rama vectorial. En medio pasaron dos cosas a la vez —la función
 * nueva y un corpus que crecio en miles de mensajes— y el README decía que no
 * estaban separadas. Esto las separa.
 *
 *   E2E_APP_URL=https://… node tests/bench/search-breakdown.mjs
 *
 * Tres condiciones sobre la misma cuenta recién creada, así que el tamaño del
 * corpus propio es constante y lo único que cambia es el camino:
 *
 *   corta   consulta de menos de 15 caracteres → sin rama vectorial
 *   fría    consulta larga cuya embedding no está en caché → una llamada al modelo
 *   caliente la misma consulta larga otra vez → la caché responde
 *
 * La diferencia entre «corta» y «caliente» es lo que cuesta la rama vectorial
 * cuando no hay que embeber nada. La diferencia entre «caliente» y «fría» es lo
 * que cuesta el modelo. Y comparar con los 314 ms históricos ya no mezcla las
 * dos cosas.
 */
import { api, APP, cleanup, makeUser, onboard, requireServer } from '../e2e/harness.mjs';

const SAMPLES = Number(process.env.BENCH_SAMPLES ?? 15);

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

function report(label, values, nota) {
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  console.log(
    `  ${label.padEnd(9)} media ${mean.toFixed(0).padStart(4)} ms · p50 ${percentile(values, 50)
      .toFixed(0)
      .padStart(4)} · p95 ${percentile(values, 95).toFixed(0).padStart(4)}   ${nota}`,
  );
  return percentile(values, 50);
}

async function timeSearch(user, query) {
  const started = performance.now();
  await api(`/api/search?q=${encodeURIComponent(query)}&scope=messages`, { actor: user });
  return performance.now() - started;
}

await requireServer();
console.log(`\ndesglose de la búsqueda -> ${APP}`);
console.log(`muestras por condición: ${SAMPLES}\n`);

const user = await makeUser('breakdown');
await onboard(user);

// Una conversación con contenido propio, para que la búsqueda tenga sobre qué
// trabajar sin depender de lo que haya sembrado el resto del día.
const conversation = await api('/api/conversations', {
  method: 'POST',
  actor: user,
  body: { name: 'Breakdown', accent: 'electric', memberIds: [] },
});
const conversationId = (conversation.json?.conversation ?? conversation.json)?.id;

for (let i = 0; i < 12; i += 1) {
  await api(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    actor: user,
    body: {
      content: `The functions were running in Washington while the database sits in Frankfurt (${i}).`,
      clientId: `breakdown-${i}`,
    },
  });
}

// Un momento para que se generen los embeddings, que van fuera de la respuesta.
await new Promise((resolve) => setTimeout(resolve, 8000));

// --- Condiciones -------------------------------------------------------------

const corta = [];
const caliente = [];
const fria = [];

process.stdout.write('midiendo');
for (let i = 0; i < SAMPLES; i += 1) {
  // Menos de 15 caracteres: el servicio ni intenta embeber, así que este es
  // exactamente el camino de antes de la busqueda hibrida.
  corta.push(await timeSearch(user, 'Frankfurt'));

  // Consulta distinta en cada vuelta para forzar fallo de caché: es lo que
  // cuesta la primera vez que alguien pregunta algo.
  fria.push(await timeSearch(user, `where exactly did the functions run number ${i}`));

  // Y la misma consulta repetida, que es el caso normal.
  caliente.push(await timeSearch(user, 'where exactly did the functions run'));

  process.stdout.write('.');
}
console.log('\n');

const pCorta = report('corta', corta, 'sin rama vectorial (camino de antes)');
const pCaliente = report('caliente', caliente, 'con vector, embedding en caché');
const pFria = report('fría', fria, 'con vector, embedding recién calculada');

console.log('');
console.log(`  la rama vectorial cuesta   ${(pCaliente - pCorta).toFixed(0).padStart(4)} ms  (caliente − corta)`);
console.log(`  embeber la consulta cuesta ${(pFria - pCaliente).toFixed(0).padStart(4)} ms  (fría − caliente)`);
console.log('');
console.log('  Lo que no explique esa suma es del corpus, no de la función.');

await cleanup();
