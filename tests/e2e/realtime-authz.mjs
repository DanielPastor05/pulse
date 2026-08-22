/**
 * ¿Aguanta la autorización del tiempo real a un cliente que no es el navegador?
 *
 *   E2E_APP_URL=https://… node tests/e2e/realtime-authz.mjs
 *
 * Esta es la pregunta que la auditoría del 22/08/2026 dejó sin responder, y la
 * señaló como su hueco más grande. El resto de la aplicación tiene dos capas —
 * si un endpoint olvidara comprobar la pertenencia, RLS seguiría negando la
 * fila. El tiempo real **no pasa por los endpoints**: el cliente habla directo
 * con Supabase, así que `private.can_use_realtime_topic()` no es una segunda
 * capa, es la única.
 *
 * Un canal mal autorizado ahí filtraría cada mensaje de una conversación
 * ajena, en directo, sin dejar rastro en los registros de la aplicación. Es el
 * peor fallo que este proyecto podría tener, y hasta ahora la confianza en que
 * no existe venía de haber leído la política.
 *
 * Aquí se ataca. Mallory no es miembro de nada y se fabrica su propio cliente
 * con `@supabase/supabase-js`, exactamente lo que haría alguien con la clave
 * anónima —que es pública— y una cuenta cualquiera.
 */
import { api, check, cleanup, makeUser, onboard, requireServer } from './harness.mjs';
import { clientFor, subscribed, waitFor } from './realtime-helpers.mjs';

await requireServer();

console.log('\npreparando…');
const alice = await makeUser('alice');
const bob = await makeUser('bob');
const mallory = await makeUser('mallory');
await Promise.all([onboard(alice), onboard(bob), onboard(mallory)]);

const grupo = await api('/api/conversations', {
  actor: alice,
  method: 'POST',
  body: { type: 'GROUP', name: 'Sala privada', memberIds: [bob.id] },
});
const grupoId = grupo.json?.id ?? grupo.json?.conversation?.id;
check('el grupo privado existe', grupo.status, 201);

// ---------------------------------------------------------------------------
// 1. El control positivo va PRIMERO
// ---------------------------------------------------------------------------
// Si el tiempo real estuviera caído, todos los rechazos de abajo pasarían sin
// haber probado nada. Se comprueba antes que un miembro sí entra y sí recibe.
console.log('\ncontrol positivo — un miembro sí entra y sí recibe:');

const clienteBob = clientFor(bob);
const canalBob = clienteBob.channel(`conversation:${grupoId}`, { config: { private: true } });
const estadoBob = await subscribed(canalBob);
check('Bob se suscribe al canal de su grupo', estadoBob, 'SUBSCRIBED');

const esperaBob = waitFor(canalBob, 'message.created', 20_000);
await api(`/api/conversations/${grupoId}/messages`, {
  actor: alice,
  method: 'POST',
  body: { content: 'secreto que sólo deben ver los miembros', clientId: 'rt-1' },
});
const recibido = await esperaBob;
check('y le llega el mensaje en directo', Boolean(recibido), true);

// ---------------------------------------------------------------------------
// 2. Mallory, con su propio cliente
// ---------------------------------------------------------------------------
console.log('\nun cliente hecho a mano no entra donde no le llaman:');

const clienteMallory = clientFor(mallory);

const AJENOS = [
  ['el canal de la conversación', `conversation:${grupoId}`],
  ['el canal de señalización de llamada', `call:${grupoId}`],
  ['el canal personal de Alice', `user:${alice.id}`],
  ['el canal personal de Bob', `user:${bob.id}`],
];

for (const [etiqueta, topico] of AJENOS) {
  const canal = clienteMallory.channel(topico, { config: { private: true } });
  const estado = await subscribed(canal, 12_000);
  const ok = estado !== 'SUBSCRIBED';
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${etiqueta} -> ${estado}`);
  if (!ok) process.exitCode = 1;
  await clienteMallory.removeChannel(canal);
}

// ---------------------------------------------------------------------------
// 3. Lo definitivo: aunque se suscribiera, ¿le llegaría el contenido?
// ---------------------------------------------------------------------------
// El estado de suscripción es lo que dice el servidor. Lo que importa de
// verdad es si el mensaje viaja. Se intenta escuchar y se manda tráfico real.
console.log('\ny aunque lo intente, no le llega el contenido:');

const espia = clienteMallory.channel(`conversation:${grupoId}`, { config: { private: true } });
const filtracion = waitFor(espia, 'message.created', 12_000);
subscribed(espia, 12_000); // sin await: interesa escuchar, no el estado

await api(`/api/conversations/${grupoId}/messages`, {
  actor: alice,
  method: 'POST',
  body: { content: 'segundo secreto, mientras Mallory escucha', clientId: 'rt-2' },
});

const filtrado = await filtracion;
check('Mallory no recibe nada del canal ajeno', filtrado, null);

// El canal propio de Mallory sí funciona: sin esto, «no recibió nada» pasaría
// igual si su cliente estuviera roto.
const suyo = clienteMallory.channel(`user:${mallory.id}`, { config: { private: true } });
check('pero su propio canal sí la admite', await subscribed(suyo, 12_000), 'SUBSCRIBED');

// ---------------------------------------------------------------------------
// 4. La puerta de al lado: el mismo topic, pero como canal público
// ---------------------------------------------------------------------------
/*
 * El proyecto tiene «Allow public access to channels» activado en Supabase, y
 * eso abre una pregunta que las comprobaciones de arriba no hacen: todas atacan
 * con `private: true`, que es el camino que la política RLS autoriza. ¿Y si
 * alguien se suscribe al **mismo topic sin marcar `private`**?
 *
 * Si el contenido viajara igual, la autorización del tiempo real no valdría
 * nada: bastaría con no pedir permiso para no necesitarlo. No es el caso —el
 * broadcast privado no cruza al espacio público— pero es exactamente el tipo de
 * salto que se descubre tarde, así que se queda comprobado.
 */
console.log('\ny tampoco por la puerta pública del mismo topic:');

const publico = clienteMallory.channel(`conversation:${grupoId}`);
const porLaPublica = waitFor(publico, 'message.created', 12_000);
const estadoPublico = await subscribed(publico, 12_000);

await api(`/api/conversations/${grupoId}/messages`, {
  actor: alice,
  method: 'POST',
  body: { content: 'tercer secreto, con Mallory en el canal público', clientId: 'rt-3' },
});

// La suscripción pública sí se establece —los canales públicos están
// permitidos— y eso es justo lo que hace la comprobación necesaria: lo que no
// puede pasar es que además reciba.
console.log(`  (la suscripción pública se establece: ${estadoPublico})`);
check('el canal público no recibe el tráfico privado', await porLaPublica, null);

await clienteBob.removeAllChannels();
await clienteMallory.removeAllChannels();
await cleanup();
console.log('\ncuentas de prueba borradas');
