/**
 * Cerrar una cuenta no debe dejar salas vacías detrás.
 *
 *   E2E_APP_URL=https://… node tests/e2e/account-debris.mjs
 *
 * Borrar la cuenta quita sus filas de `conversation_members`, pero durante
 * mucho tiempo no tocaba la conversación. Cuando se iba la última persona
 * quedaba una sala vacía: invisible desde la aplicación, porque todo filtra por
 * pertenencia, y con todos sus mensajes y adjuntos todavía dentro. El
 * 21/08/2026 eso era el **95%** de la tabla en producción.
 *
 * La prueba mira las dos formas que tiene de pasar:
 *
 *   - el hilo con el asistente, donde al irse la persona queda un miembro que
 *     no es nadie — el recuento de filas da uno y el barrido antiguo lo dejaba
 *     pasar;
 *   - el grupo donde sí queda alguien, que **no** debe borrarse.
 *
 * Ese segundo caso es el que separa esta prueba de un placebo: sin él, un
 * barrido que borrase todo pasaría igual.
 */
import { api, check, cleanup, makeUser, onboard, requireServer, admin } from './harness.mjs';

await requireServer();

console.log('\npreparando identidades…');
const ana = await makeUser('ana');
const bob = await makeUser('bob');
await Promise.all([onboard(ana), onboard(bob)]);

// Una sala que se queda sin nadie, y otra donde Bob se queda dentro.
const conAsistente = await api('/api/assistant', { method: 'POST', actor: ana });
const soloAna = conAsistente.json?.id;

// El grupo lo crea **Bob**, no Ana.
//
// Con Ana de dueña, cerrar su cuenta devuelve 409: ya hay una guarda que se
// niega a dejar una sala con gente dentro y nadie que pueda administrarla. Es
// correcta y sale antes que lo que esta prueba quiere mirar, así que la prueba
// tiene que montar el caso donde ese 409 no aplica.
const grupo = await api('/api/conversations', {
  method: 'POST',
  actor: bob,
  body: { type: 'GROUP', name: 'Aquí se queda Bob', memberIds: [ana.id] },
});
const conBob = grupo.json?.id ?? grupo.json?.conversation?.id;

// Que las dos tengan contenido: una sala vacía sin mensajes es basura barata;
// la cara es la que se lleva mensajes y adjuntos por delante.
for (const id of [soloAna, conBob]) {
  await api(`/api/conversations/${id}/messages`, {
    method: 'POST',
    actor: ana,
    body: { content: 'algo escrito, para que borrar cueste', attachments: [] },
  });
}

const existe = async (id) => {
  const { count } = await admin
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('id', id);
  return count === 1;
};

check('la sala con el asistente existe antes', await existe(soloAna), true);
check('y el grupo con Bob también', await existe(conBob), true);

// ---------------------------------------------------------------------------
console.log('\ncerrar la cuenta de Ana');

const perfil = await api('/api/me', { actor: ana });
const borrado = await api('/api/me', {
  method: 'DELETE',
  actor: ana,
  body: { confirmation: perfil.json?.username, password: ana.password },
});
check('la cuenta se cierra', borrado.status, 200);

check('la sala que se queda sin nadie desaparece', await existe(soloAna), false);
check('el grupo donde queda Bob NO desaparece', await existe(conBob), true);

await cleanup();
console.log('');
