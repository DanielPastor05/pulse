/**
 * ¿Cuánto tarda en aparecer «X está escribiendo» al otro lado?
 *
 *   E2E_APP_URL=https://… node tests/bench/typing.mjs
 *
 * La pregunta salió de usar la aplicación: se nota un retardo. «Se nota» no es
 * una medida, y el retardo tiene tres partes que se confunden con facilidad:
 *
 *   1. **El acelerador del cliente.** Sólo sale un paquete cada 2 s. La primera
 *      pulsación sí sale al momento (`lastTypingSentAt` arranca en 0), así que
 *      esta parte no afecta a la primera aparición — pero sí a la segunda.
 *   2. **El viaje por Realtime**, que es lo que mide esto.
 *   3. **La suscripción al canal.** Si abres una conversación y escribes antes
 *      de que el canal esté suscrito, el paquete no sale. Es la sospecha más
 *      probable cuando el retardo aparece «al abrir» y no «al escribir», así
 *      que se mide aparte: cuánto tarda el canal en estar listo.
 *
 * Se emite el mismo evento que emite el navegador, por el mismo canal privado y
 * con `channel.send()`, no por la API: el indicador de escritura no pasa por
 * ningún endpoint.
 */
import { api, check, cleanup, makeUser, onboard, requireServer } from '../e2e/harness.mjs';
import { clientFor, subscribed } from '../e2e/realtime-helpers.mjs';

await requireServer();

const RONDAS = 12;

console.log('\npreparando…');
const alice = await makeUser('alice');
const bob = await makeUser('bob');
await onboard(alice);
await onboard(bob);

const grupo = await api('/api/conversations', {
  actor: alice,
  method: 'POST',
  body: { type: 'GROUP', name: 'Escribiendo', memberIds: [bob.id] },
});
const id = grupo.json?.id ?? grupo.json?.conversation?.id;
check('el grupo existe', Boolean(id), true);

// ---------------------------------------------------------------------------
// 1. Cuánto tarda el canal en quedar listo
// ---------------------------------------------------------------------------
console.log('\ncuánto tarda un canal en estar suscrito:');

const suscripciones = [];
for (let i = 0; i < 3; i += 1) {
  const cliente = clientFor(alice);
  const canal = cliente.channel(`conversation:${id}`, { config: { private: true } });
  const empezado = performance.now();
  const estado = await subscribed(canal);
  const ms = Math.round(performance.now() - empezado);
  suscripciones.push(ms);
  console.log(`  intento ${i + 1}: ${estado} en ${ms} ms`);
  await cliente.removeAllChannels();
}

// ---------------------------------------------------------------------------
// 2. El viaje de un evento de escritura
// ---------------------------------------------------------------------------
console.log(`\nviaje de un evento «typing», ${RONDAS} rondas:`);

const clienteAlice = clientFor(alice);
const clienteBob = clientFor(bob);

const canalAlice = clienteAlice.channel(`conversation:${id}`, { config: { private: true } });
const canalBob = clienteBob.channel(`conversation:${id}`, { config: { private: true } });

check('Alice entra en el canal', await subscribed(canalAlice), 'SUBSCRIBED');
check('Bob entra en el canal', await subscribed(canalBob), 'SUBSCRIBED');

const tiempos = [];
for (let i = 0; i < RONDAS; i += 1) {
  const marca = `t-${i}-${Math.random().toString(36).slice(2, 7)}`;

  const llegada = new Promise((resolver) => {
    const escuchar = ({ payload }) => {
      if (payload?.displayName === marca) resolver(performance.now());
    };
    canalBob.on('broadcast', { event: 'typing' }, escuchar);
    setTimeout(() => resolver(null), 8_000);
  });

  const enviado = performance.now();
  await canalAlice.send({
    type: 'broadcast',
    event: 'typing',
    payload: { userId: alice.id, displayName: marca, conversationId: id },
  });

  const recibido = await llegada;
  if (recibido === null) {
    console.log(`  ronda ${i + 1}: no llegó`);
    process.exitCode = 1;
    continue;
  }
  const ms = Math.round(recibido - enviado);
  tiempos.push(ms);
  // Un respiro entre rondas: seguidas medirían la cola del socket, no el viaje.
  await new Promise((listo) => setTimeout(listo, 300));
}

const ordenados = [...tiempos].sort((a, b) => a - b);
const percentil = (p) => ordenados[Math.min(ordenados.length - 1, Math.floor(ordenados.length * p))];

console.log(`\n  muestras: ${tiempos.join(', ')} ms`);
console.log(`  p50 ${percentil(0.5)} ms · p95 ${percentil(0.95)} ms · máx ${ordenados.at(-1)} ms`);
console.log(`  suscripción del canal: ${suscripciones.join(', ')} ms`);

/*
 * El presupuesto, y de dónde sale.
 *
 * 100 ms es el umbral clásico por debajo del cual una respuesta se percibe como
 * instantánea. Un indicador de escritura no lo necesita —no es una pulsación de
 * botón— pero por encima de un segundo deja de significar «está escribiendo
 * ahora» y pasa a significar «escribió hace un momento», que es otra cosa.
 */
check('el evento llega en menos de un segundo (p50)', percentil(0.5) < 1_000, true);

await clienteAlice.removeAllChannels();
await clienteBob.removeAllChannels();
await cleanup();
console.log('\ncuentas de prueba borradas');
