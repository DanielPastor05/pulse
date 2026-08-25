/**
 * El asistente, contra la instancia desplegada.
 *
 *   E2E_APP_URL=https://… node tests/e2e/assistant.mjs
 *
 * Lo que puede estar mal aquí no es que el modelo conteste —eso lo dice
 * cualquier `curl`— sino las tres cosas que lo rodean:
 *
 *   1. Que **no se conteste a sí mismo**. Su respuesta vuelve a pasar por el
 *      mismo envío que la provocó, así que sin la guarda los dos se quedan
 *      hablando para siempre y la factura de neuronas la paga el despliegue.
 *   2. Que **no conteste en grupos**, donde nadie ha decidido a qué debe
 *      responder.
 *   3. Que se **vea** que no hay una persona detrás.
 */
import { api, check, cleanup, makeUser, onboard, requireServer } from './harness.mjs';

await requireServer();

/** Cuánto se le da para pensar. El modelo tardó 545 ms al medirlo; esto sobra. */
const ESPERA_MAX_MS = 45_000;
const SONDEO_MS = 2_000;

const espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Espera a que aparezca un mensaje del asistente y lo devuelve. */
async function esperarRespuesta(conversationId, actor, asistenteId, desde = 0) {
  const partida = Date.now();
  while (Date.now() - partida < ESPERA_MAX_MS) {
    const hilo = await api(`/api/conversations/${conversationId}/messages`, { actor });
    const suyos = (hilo.json?.items ?? []).filter((m) => m.author?.id === asistenteId);
    if (suyos.length > desde) return { mensajes: suyos, ms: Date.now() - partida };
    await espera(SONDEO_MS);
  }
  return { mensajes: [], ms: Date.now() - partida };
}

console.log('\npreparando identidades…');
const ana = await makeUser('ana');
await onboard(ana);

// ---------------------------------------------------------------------------
console.log('\nabrir el hilo');

const abierto = await api('/api/assistant', { method: 'POST', actor: ana });
check('se abre la conversación con el asistente', abierto.status, 201);

const id = abierto.json?.id;
const asistente = abierto.json?.peer;
check('viene con la otra parte', Boolean(asistente?.id), true);
check('y marcada como asistente', asistente?.isAssistant, true);
check('en línea, porque no duerme', asistente?.presence, 'ONLINE');

const otraVez = await api('/api/assistant', { method: 'POST', actor: ana });
check('abrirlo dos veces no crea dos hilos', otraVez.json?.id, id);

// ---------------------------------------------------------------------------
console.log('\npreguntar');

await api(`/api/conversations/${id}/messages`, {
  method: 'POST',
  actor: ana,
  body: { content: '¿En una frase, qué es una clave foránea?', attachments: [] },
});

const primera = await esperarRespuesta(id, ana, asistente.id);
check('responde', primera.mensajes.length > 0, true);
if (primera.mensajes.length > 0) {
  console.log(`        tardó ${(primera.ms / 1000).toFixed(1)} s`);
  console.log(`        «${primera.mensajes.at(-1).content.replace(/\s+/g, ' ').slice(0, 110)}»`);
  check('con algo escrito dentro', primera.mensajes.at(-1).content.trim().length > 0, true);
}

// ---------------------------------------------------------------------------
console.log('\nno se contesta a sí mismo');

// Si su propia respuesta volviera a provocar otra, el número crecería solo. Se
// espera de sobra —más que lo que tarda en responder— y se vuelve a contar.
const antes = primera.mensajes.length;
await espera(15_000);

const hilo = await api(`/api/conversations/${id}/messages`, { actor: ana });
const ahora = (hilo.json?.items ?? []).filter((m) => m.author?.id === asistente.id).length;
check('sigue habiendo los mismos mensajes suyos', ahora, antes);

// ---------------------------------------------------------------------------
console.log('\nno contesta en grupos');

const bob = await makeUser('bob');
await onboard(bob);

const grupo = await api('/api/conversations', {
  method: 'POST',
  actor: ana,
  body: { type: 'GROUP', name: 'Sin asistente', memberIds: [bob.id] },
});
const grupoId = grupo.json?.id ?? grupo.json?.conversation?.id;

// Meterlo en el grupo a propósito: la guarda que importa es la del tipo de
// conversación, no la de que no esté dentro.
const metido = await api(`/api/conversations/${grupoId}/members`, {
  method: 'POST',
  actor: ana,
  body: { userIds: [asistente.id] },
});
console.log(`        (añadirlo al grupo -> ${metido.status})`);

await api(`/api/conversations/${grupoId}/messages`, {
  method: 'POST',
  actor: ana,
  body: { content: 'Hola asistente, ¿estás?', attachments: [] },
});

await espera(20_000);
const enGrupo = await api(`/api/conversations/${grupoId}/messages`, { actor: ana });
const suyosEnGrupo = (enGrupo.json?.items ?? []).filter((m) => m.author?.id === asistente.id).length;
check('no ha dicho nada en el grupo', suyosEnGrupo, 0);

await cleanup();
console.log('');
