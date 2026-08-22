/**
 * Abuso desde dentro: ¿puede un miembro dejar sorda una conversación?
 *
 *   E2E_APP_URL=https://… node tests/e2e/realtime-flood.mjs
 *
 * `realtime-authz.mjs` responde «¿puede entrar quien no debe?» — y no. Esto
 * pregunta lo contrario: alguien que **sí** tiene derecho a estar en el canal,
 * ¿puede usarlo para estropearlo a los demás?
 *
 * Importa porque el límite de peticiones de la aplicación no lo cubre. Ese
 * limitador está en los endpoints, y los eventos de tiempo real **no pasan por
 * ahí**: el cliente los emite directo contra Supabase. Un miembro con malas
 * intenciones no gasta cuota de API para inundar.
 *
 * Lo que se mide no es cuántos eventos se pueden emitir, que es un número sin
 * consecuencia por sí solo, sino si **el mensaje legítimo sigue llegando** a
 * los demás mientras dura la inundación. Esa es la diferencia entre ruido y
 * denegación de servicio.
 */
import { api, check, cleanup, makeUser, onboard, requireServer } from './harness.mjs';
import { clientFor, subscribed, waitFor } from './realtime-helpers.mjs';

await requireServer();

const POR_SEGUNDO = 200;
const DURACION_MS = 8_000;

console.log('\npreparando…');
const alice = await makeUser('flood');
const bob = await makeUser('victima');
await Promise.all([onboard(alice), onboard(bob)]);

const grupo = await api('/api/conversations', {
  actor: alice, method: 'POST', body: { type: 'GROUP', name: 'Sala inundada', memberIds: [bob.id] },
});
const grupoId = grupo.json?.id ?? grupo.json?.conversation?.id;
check('el grupo existe', grupo.status, 201);

const clienteBob = clientFor(bob);
const canalBob = clienteBob.channel(`conversation:${grupoId}`, { config: { private: true } });

/*
 * Se cuenta lo que **llega**, no lo que se emite.
 *
 * `channel.send()` devuelve `'ok'` en cuanto escribe en el socket: no es un
 * acuse del servidor. Contar rechazos ahí da siempre cero y no demuestra que no
 * haya límite — demuestra que el cliente no se entera. Lo único que dice algo
 * es cuántos de los emitidos aparecen al otro lado.
 */
let recibidos = 0;
canalBob.on('broadcast', { event: 'typing' }, () => {
  recibidos += 1;
});

check('Bob escucha', await subscribed(canalBob), 'SUBSCRIBED');

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Manda un mensaje por la API y cronometra cuánto tarda en llegarle a Bob. */
async function medirEntrega(etiqueta, clientId) {
  const espera = waitFor(canalBob, 'message.created', 25_000);
  const t0 = Date.now();
  const r = await api(`/api/conversations/${grupoId}/messages`, {
    actor: alice, method: 'POST', body: { content: etiqueta, clientId },
  });
  const llegada = await espera;
  return { ok: Boolean(llegada), ms: Date.now() - t0, estado: r.status };
}

// --- línea base, con el canal en calma ------------------------------------
console.log('\nlínea base, sin ruido:');
const base = await medirEntrega('mensaje tranquilo', 'fl-base');
check('llega con el canal en calma', base.ok, true);
console.log(`  entrega: ${base.ms} ms`);

// --- la inundación ---------------------------------------------------------
console.log(`\ninundando: ${POR_SEGUNDO}/s durante ${DURACION_MS / 1000} s desde una cuenta legítima`);

const clienteAlice = clientFor(alice);
const canalAlice = clienteAlice.channel(`conversation:${grupoId}`, { config: { private: true } });
const estadoAlice = await subscribed(canalAlice);
check('la inundadora está dentro', estadoAlice, 'SUBSCRIBED');

let emitidos = 0;
let rechazados = 0;
const hasta = Date.now() + DURACION_MS;

const inundar = (async () => {
  while (Date.now() < hasta) {
    for (let i = 0; i < POR_SEGUNDO / 20; i += 1) {
      // `typing` es el evento más barato y el que un cliente emite de verdad,
      // así que es lo que emitiría alguien abusando sin escribir nada raro.
      const r = await canalAlice.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: alice.id, displayName: 'inundación', conversationId: grupoId },
      });
      if (r === 'ok') emitidos += 1;
      else rechazados += 1;
    }
    await dormir(50);
  }
})();

// A mitad de la inundación, un mensaje legítimo.
await dormir(DURACION_MS / 2);
const durante = await medirEntrega('mensaje durante la inundación', 'fl-durante');

await inundar;

console.log(`  eventos emitidos:   ${emitidos}`);
console.log(`  eventos rechazados: ${rechazados}`);
console.log(`  entrega durante:    ${durante.ms} ms  (${durante.ok ? 'llegó' : 'NO LLEGÓ'})`);

// --- después ---------------------------------------------------------------
await dormir(2_000);
const despues = await medirEntrega('mensaje después', 'fl-despues');
console.log(`  entrega después:    ${despues.ms} ms  (${despues.ok ? 'llegó' : 'NO LLEGÓ'})`);

console.log('\nlo que decide:');
check('el mensaje legítimo llega durante la inundación', durante.ok, true);
check('y sigue llegando después', despues.ok, true);
check('el envío por API no se rompe', durante.estado, 201);

/*
 * El umbral es 10× la línea base y no un número absoluto: la entrega en vivo
 * depende de la distancia a la región, y fijar «menos de X ms» mediría eso en
 * vez de la degradación. Lo que interesa es si la inundación **empeora** la
 * entrega, no cuánto tarda en general.
 */
const degradacion = durante.ms / Math.max(base.ms, 1);
console.log(`\n  entrega durante / línea base: ${degradacion.toFixed(2)}×`);
if (degradacion > 10) {
  console.log('  DEGRADACIÓN GRAVE — un miembro puede dejar sorda la conversación');
  process.exitCode = 1;
} else {
  console.log('  la inundación no impide que los demás reciban');
}

/*
 * Cuántos de los emitidos llegan de verdad. Es lo que dice si el servicio pone
 * algún techo, y también lo que cuesta: cada evento entregado consume cuota de
 * Realtime del proyecto, y esa cuota la gasta un miembro cualquiera sin pasar
 * por el limitador de la API.
 */
const proporcion = emitidos > 0 ? recibidos / emitidos : 0;
console.log(`\n  eventos que llegaron a Bob: ${recibidos} de ${emitidos}  (${(proporcion * 100).toFixed(0)}%)`);
console.log(
  proporcion > 0.9
    ? '  el servicio NO recorta: un miembro puede gastar cuota de Realtime a voluntad'
    : '  el servicio recorta parte del caudal',
);
if (rechazados > 0) console.log(`  (${rechazados} rechazados en el cliente)`);

await clienteAlice.removeAllChannels();
await clienteBob.removeAllChannels();
await cleanup();
console.log('\ncuentas de prueba borradas');
