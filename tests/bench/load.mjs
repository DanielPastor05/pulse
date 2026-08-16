/**
 * Carga y latencia de entrega en tiempo real.
 *
 * La pregunta que ningún otro banco responde: cuánto tarda un mensaje en
 * aparecer en la pantalla de la otra persona. No es la latencia del POST — eso
 * sólo dice cuándo lo aceptó el servidor — sino el camino entero, incluido el
 * fan-out por el canal privado, que es lo que decide si la aplicación se siente
 * viva.
 *
 *   node tests/bench/load.mjs
 *   E2E_APP_URL=https://… BENCH_SENDERS=12 BENCH_ROUNDS=4 node tests/bench/load.mjs
 *
 * Dos cautelas que hacen que las cifras signifiquen algo:
 *
 * 1. El limitador acepta 25 envíos por 10 s **por usuario**, así que la carga se
 *    genera con muchas cuentas y no repitiendo con una. Un 429 aquí mediría el
 *    limitador en vez de la aplicación, así que se cuentan aparte y se dicen.
 * 2. La máquina que mide está lejos del edge. Se toma una línea base contra un
 *    recurso estático y se publica junto al resto, porque sin ella los números
 *    son de esta máquina y no del sistema.
 */
import { api, APP, cleanup, makeUser, onboard, requireServer } from '../e2e/harness.mjs';
import { clientFor, collectArrivals, subscribed } from '../e2e/realtime-helpers.mjs';

const SENDERS = Number(process.env.BENCH_SENDERS ?? 10);
const ROUNDS = Number(process.env.BENCH_ROUNDS ?? 3);
const SETTLE_MS = Number(process.env.BENCH_SETTLE_MS ?? 4_000);
/**
 * `BENCH_SPREAD=1` da a cada emisor su propia conversación.
 *
 * Es el experimento que separa las dos explicaciones de por qué los envíos
 * concurrentes se serializan: si repartirlos entre conversaciones distintas
 * arregla la latencia, el cuello es el bloqueo de fila sobre la conversación
 * compartida; si no cambia nada, es el pool de conexiones. Sin esta distinción
 * el arreglo sería una apuesta.
 *
 * Con reparto no se mide la entrega en vivo: cada emisor escribe donde el
 * receptor no escucha.
 */
const SPREAD = process.env.BENCH_SPREAD === '1';

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function report(label, values, unit = 'ms') {
  if (values.length === 0) {
    console.log(`${label.padEnd(30)} sin muestras`);
    return;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((total, value) => total + value, 0) / sorted.length;
  console.log(
    `${label.padEnd(30)} media ${mean.toFixed(0).padStart(5)} ${unit} · ` +
      `p50 ${percentile(sorted, 50).toFixed(0).padStart(5)} · ` +
      `p95 ${percentile(sorted, 95).toFixed(0).padStart(5)} · ` +
      `p99 ${percentile(sorted, 99).toFixed(0).padStart(5)}`,
  );
}

await requireServer();

// --- Línea base de red -------------------------------------------------------
// Un recurso estático no toca base de datos ni sesión: lo que tarde es la
// distancia de esta máquina al edge, y todo lo demás la lleva dentro.
const baseline = [];
for (let i = 0; i < 8; i += 1) {
  const started = performance.now();
  await fetch(`${APP}/manifest.webmanifest`, { cache: 'no-store' });
  baseline.push(performance.now() - started);
}
console.log(`\nbanco de carga -> ${APP}`);
console.log(`emisores: ${SENDERS} · rondas: ${ROUNDS}\n`);
report('línea base de red', baseline);

// --- Montaje -----------------------------------------------------------------
process.stdout.write('\ncreando cuentas');
const receiver = await makeUser('recv');
await onboard(receiver);

const senders = [];
for (let i = 0; i < SENDERS; i += 1) {
  const user = await makeUser(`send${i}`);
  await onboard(user);
  senders.push(user);
  process.stdout.write('.');
}
console.log('');

const group = await api('/api/conversations', {
  method: 'POST',
  actor: receiver,
  body: {
    name: 'Sala de carga',
    accent: 'electric',
    memberIds: senders.map((user) => user.id),
  },
});
const conversationId = (group.json?.conversation ?? group.json)?.id;
if (!conversationId) {
  console.log('no se pudo crear la conversación');
  await cleanup();
  process.exit(1);
}

// El receptor escucha exactamente como lo haría el navegador.
const receiverClient = clientFor(receiver);
// El mismo topic que arma `realtimeChannels.conversation` en src/lib/realtime.ts.
const channel = receiverClient.channel(`conversation:${conversationId}`, {
  config: { private: true },
});
const arrivals = collectArrivals(channel, 'message.created');

const status = await subscribed(channel);
if (status !== 'SUBSCRIBED') {
  console.log(`el receptor no pudo suscribirse: ${status}`);
  await cleanup();
  process.exit(1);
}
console.log('receptor suscrito al canal privado\n');

// --- Carga -------------------------------------------------------------------
const accepted = [];
const rateLimited = [];
const sentAt = new Map();
let failures = 0;

// Con reparto, cada emisor escribe en una sala propia.
const targets = [];
if (SPREAD) {
  process.stdout.write('creando una conversación por emisor');
  for (const user of senders) {
    const own = await api('/api/conversations', {
      method: 'POST',
      actor: user,
      body: { name: `Sala de ${user.id.slice(0, 6)}`, accent: 'electric', memberIds: [] },
    });
    targets.push((own.json?.conversation ?? own.json)?.id);
    process.stdout.write('.');
  }
  console.log('\n');
}

for (let round = 0; round < ROUNDS; round += 1) {
  // Todos los emisores a la vez: es la forma de que el servidor tenga trabajo
  // concurrente de verdad y no una cola disfrazada.
  const results = await Promise.all(
    senders.map(async (user, index) => {
      const clientId = `load-${round}-${index}-${Date.now()}`;
      const started = performance.now();
      sentAt.set(clientId, started);

      const target = SPREAD ? targets[index] : conversationId;
      const response = await api(`/api/conversations/${target}/messages`, {
        method: 'POST',
        actor: user,
        body: { content: `carga ronda ${round} emisor ${index}`, clientId },
      });

      return { status: response.status, elapsed: performance.now() - started };
    }),
  );

  for (const result of results) {
    if (result.status === 201) accepted.push(result.elapsed);
    else if (result.status === 429) rateLimited.push(result.elapsed);
    else failures += 1;
  }

  process.stdout.write(`ronda ${round + 1}/${ROUNDS} `);
  // Deja respirar la ventana del limitador entre rondas, para que la siguiente
  // mida la aplicación y no el rechazo.
  if (round < ROUNDS - 1) await new Promise((resolve) => setTimeout(resolve, 10_500));
}
console.log('\n');

// Los mensajes siguen llegando después del último POST: el fan-out es
// asíncrono respecto a la respuesta, que es justo lo que se está midiendo.
await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

// --- Resultados --------------------------------------------------------------
const deliveries = [];
for (const [clientId, arrivedAt] of arrivals) {
  const started = sentAt.get(clientId);
  if (started !== undefined) deliveries.push(arrivedAt - started);
}

const attempted = accepted.length + rateLimited.length + failures;
const delivered = deliveries.length;

report('POST aceptado (201)', accepted);
report('entrega extremo a extremo', deliveries);
console.log('');
console.log(`intentos                       ${attempted}`);
console.log(`aceptados                      ${accepted.length}`);
console.log(`limitados (429)                ${rateLimited.length}  ← el limitador haciendo su trabajo`);
console.log(`errores                        ${failures}`);
console.log(
  `entregados en vivo             ${delivered}/${accepted.length}` +
    (accepted.length ? ` (${((delivered / accepted.length) * 100).toFixed(1)}%)` : ''),
);

await receiverClient.removeChannel(channel);
await cleanup();
