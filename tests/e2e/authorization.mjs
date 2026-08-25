/**
 * La matriz de autorización, endpoint por endpoint.
 *
 *   E2E_APP_URL=https://… node tests/e2e/authorization.mjs
 *
 * Las otras suites comprueban escenarios elegidos a mano: que alguien de fuera
 * no lea un hilo, que un miembro raso no resuelva denuncias. Eso deja una
 * pregunta sin responder — **¿y los demás?**. Un IDOR no suele ser un
 * despiste aislado: es un endpoint que se escribió sin copiar la guarda que
 * tenían sus vecinos, y encontrarlo pide recorrerlos todos.
 *
 * Aquí se enumeran las 34 rutas que aceptan un id y se llaman con tres
 * identidades:
 *
 *   - `mallory`, que no es miembro de nada — no debe ver ni tocar nada
 *   - `bob`, miembro raso — no debe poder hacer lo que pide moderación
 *   - `alice`, dueña — la línea base de que la operación *sí* funciona
 *
 * Esa última fila es lo que separa una prueba de un placebo: sin comprobar que
 * la operación funciona para quien debe, «devolvió 403» pasaría igual si el
 * endpoint estuviera roto para todo el mundo.
 */
import { api, check, cleanup, makeUser, onboard, requireServer } from './harness.mjs';

await requireServer();

const NO_AUTORIZADO = [401, 403, 404];

/** Un fallo de autorización es cualquier 2xx donde se esperaba un rechazo. */
function niega(etiqueta, resultado) {
  const ok = NO_AUTORIZADO.includes(resultado.status);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${etiqueta} -> ${resultado.status}`);
  if (!ok) {
    process.exitCode = 1;
    console.log(`        cuerpo: ${JSON.stringify(resultado.json).slice(0, 180)}`);
  }
  return ok;
}

console.log('\npreparando identidades…');
const alice = await makeUser('alice');
const bob = await makeUser('bob');
const mallory = await makeUser('mallory');
await Promise.all([onboard(alice), onboard(bob), onboard(mallory)]);

// Grupo privado: Alice dueña, Bob miembro raso, Mallory fuera.
const grupo = await api('/api/conversations', {
  actor: alice,
  method: 'POST',
  body: { type: 'GROUP', name: 'Sala de auditoría', memberIds: [bob.id] },
});
const grupoId = grupo.json?.id ?? grupo.json?.conversation?.id;
check('el grupo se crea', grupo.status, 201);

// Y un mensaje programado suyo, para lo mismo. Va con una hora lejana para que
// no salga a mitad de la prueba y deje el id apuntando a nada — que se leería
// como «la guarda funciona» cuando en realidad no se estaría probando nada.
const programado = await api(`/api/conversations/${grupoId}/scheduled`, {
  actor: alice,
  method: 'POST',
  body: { content: 'esto es de Alice', scheduledFor: new Date(Date.now() + 86_400_000).toISOString() },
});
const programadoId = programado.json?.scheduled?.id;
check('el mensaje programado de prueba existe', Boolean(programadoId), true);

// Un mensaje de Alice, para probar los endpoints que toman id de mensaje.
const enviado = await api(`/api/conversations/${grupoId}/messages`, {
  actor: alice,
  method: 'POST',
  body: { content: 'mensaje de referencia para la auditoría', clientId: 'audit-1' },
});
const mensajeId = enviado.json?.id ?? enviado.json?.message?.id;
check('el mensaje se envía', enviado.status, 201);

// Un grupo propio de Mallory: sin un destino válido, reenviar el mensaje de
// Alice fallaría por validación y la comprobación de permisos no se ejecutaría.
const suyo = await api('/api/conversations', {
  actor: mallory,
  method: 'POST',
  body: { type: 'GROUP', name: 'Sala de Mallory', memberIds: [] },
});
const malloryGrupoId = suyo.json?.id ?? suyo.json?.conversation?.id;

console.log(`\ngrupo ${grupoId}\nmensaje ${mensajeId}\n`);

// ---------------------------------------------------------------------------
// 1. Mallory, que no es miembro de nada
// ---------------------------------------------------------------------------
console.log('nadie de fuera puede tocar la conversación:');

const DE_FUERA = [
  ['GET  la conversación', `/api/conversations/${grupoId}`, 'GET'],
  ['PATCH la conversación', `/api/conversations/${grupoId}`, 'PATCH', { name: 'secuestrada' }],
  ['DELETE la conversación', `/api/conversations/${grupoId}`, 'DELETE'],
  ['GET  los mensajes', `/api/conversations/${grupoId}/messages`, 'GET'],
  ['POST un mensaje', `/api/conversations/${grupoId}/messages`, 'POST', { content: 'entro por la cara', clientId: 'm-1' }],
  ['POST añadirse', `/api/conversations/${grupoId}/members`, 'POST', { userIds: [mallory.id] }],
  ['DELETE echar a Bob', `/api/conversations/${grupoId}/members/${bob.id}`, 'DELETE'],
  ['POST hacerse dueña', `/api/conversations/${grupoId}/owner`, 'POST', { userId: mallory.id }],
  ['POST crear invitación', `/api/conversations/${grupoId}/invites`, 'POST', { expiresInHours: 1 }],
  ['POST entrar sin más', `/api/conversations/${grupoId}/join`, 'POST', {}],
  ['GET  solicitudes', `/api/conversations/${grupoId}/join-requests`, 'GET'],
  ['GET  denuncias', `/api/conversations/${grupoId}/reports`, 'GET'],
  ['GET  registro de moderación', `/api/conversations/${grupoId}/moderation-log`, 'GET'],
  ['GET  la galería', `/api/conversations/${grupoId}/gallery`, 'GET'],
  ['GET  los fijados', `/api/conversations/${grupoId}/pins`, 'GET'],
  ['POST marcar leído', `/api/conversations/${grupoId}/read`, 'POST', { messageId: mensajeId }],
  ['PATCH preferencias', `/api/conversations/${grupoId}/preferences`, 'PATCH', { muted: true }],
  ['POST crear encuesta', `/api/conversations/${grupoId}/polls`, 'POST', { question: '¿?', options: ['a', 'b'] }],
  ['POST iniciar llamada', `/api/conversations/${grupoId}/calls`, 'POST', { mode: 'audio', callId: crypto.randomUUID() }],
  ['GET  lo programado', `/api/conversations/${grupoId}/scheduled`, 'GET'],
  ['POST programar un mensaje', `/api/conversations/${grupoId}/scheduled`, 'POST', { content: 'entro por la cara, pero luego', scheduledFor: new Date(Date.now() + 3_600_000).toISOString() }],
  ['DELETE cancelar lo de Alice', `/api/conversations/${grupoId}/scheduled/${programadoId}`, 'DELETE'],
  ['GET  el hilo', `/api/messages/${mensajeId}/thread`, 'GET'],
  ['PATCH editar el mensaje', `/api/messages/${mensajeId}`, 'PATCH', { content: 'editado por Mallory' }],
  ['DELETE borrar el mensaje', `/api/messages/${mensajeId}`, 'DELETE'],
  ['POST reaccionar', `/api/messages/${mensajeId}/reactions`, 'POST', { emoji: '👀' }],
  ['POST destacar', `/api/messages/${mensajeId}/star`, 'POST', { starred: true }],
  ['POST fijar', `/api/messages/${mensajeId}/pin`, 'POST', { pinned: true }],
  ['POST reenviar a su sala', `/api/messages/${mensajeId}/forward`, 'POST', { conversationIds: [malloryGrupoId] }],
  ['POST denunciar', `/api/messages/${mensajeId}/report`, 'POST', { reason: 'SPAM' }],
  ['PATCH cerrar la encuesta', `/api/messages/${mensajeId}/poll`, 'PATCH', {}],
];

for (const [etiqueta, path, method, body] of DE_FUERA) {
  niega(etiqueta, await api(path, { actor: mallory, method, body }));
}

// ---------------------------------------------------------------------------
// 2. Bob, miembro raso: lo que pide moderación o propiedad
// ---------------------------------------------------------------------------
console.log('\nun miembro raso no manda en el grupo:');

const RASO = [
  ['PATCH renombrar el grupo', `/api/conversations/${grupoId}`, 'PATCH', { name: 'renombrado por Bob' }],
  ['DELETE borrar el grupo', `/api/conversations/${grupoId}`, 'DELETE'],
  ['POST crear invitación', `/api/conversations/${grupoId}/invites`, 'POST', { expiresInHours: 1 }],
  ['GET  ver denuncias', `/api/conversations/${grupoId}/reports`, 'GET'],
  ['GET  registro de moderación', `/api/conversations/${grupoId}/moderation-log`, 'GET'],
  ['POST hacerse dueño', `/api/conversations/${grupoId}/owner`, 'POST', { userId: bob.id }],
  ['PATCH ascenderse a ADMIN', `/api/conversations/${grupoId}/members/${bob.id}`, 'PATCH', { role: 'ADMIN' }],
  ['DELETE echar a la dueña', `/api/conversations/${grupoId}/members/${alice.id}`, 'DELETE'],
  ['PATCH editar mensaje ajeno', `/api/messages/${mensajeId}`, 'PATCH', { content: 'editado por Bob' }],
  ['POST fijar un mensaje', `/api/messages/${mensajeId}/pin`, 'POST', { pinned: true }],
];

for (const [etiqueta, path, method, body] of RASO) {
  niega(etiqueta, await api(path, { actor: bob, method, body }));
}

// ---------------------------------------------------------------------------
// 3. Recursos de otra persona, sin conversación de por medio
// ---------------------------------------------------------------------------
console.log('\nlos recursos personales son de quien son:');

// La solicitud de amistad crea a la vez la relación y la notificación. El POST
// devuelve `{ok:true}` sin id, así que los ids se leen después — y se afirma
// que existen: un `if (id)` que se salta la prueba en silencio es la forma más
// fácil de creer que algo está cubierto cuando no se ha probado nada.
await api('/api/relationships', { actor: alice, method: 'POST', body: { userId: bob.id } });

const deBob = await api('/api/relationships', { actor: bob });
const relId = (deBob.json?.relationships ?? []).find((r) => r.direction === 'incoming')?.id;
check('la relación de prueba existe', Boolean(relId), true);

const notisBob = await api('/api/notifications', { actor: bob });
const notiId = (notisBob.json?.notifications ?? [])[0]?.id;
check('la notificación de prueba existe', Boolean(notiId), true);

if (relId) {
  niega('PATCH responder a la amistad ajena', await api(`/api/relationships/${relId}`, { actor: mallory, method: 'PATCH', body: { accept: true } }));
  niega('DELETE borrar la amistad ajena', await api(`/api/relationships/${relId}`, { actor: mallory, method: 'DELETE' }));
}
/*
 * `PATCH /api/notifications/[id]` devuelve 200 a cualquiera, y por sí solo eso
 * parece un IDOR. No lo es: el `updateMany` lleva `userId` en el `where`, así
 * que la petición de Mallory afecta a cero filas.
 *
 * Se comprueba el **efecto** y no el código de estado, porque son dos cosas
 * distintas y aquí sólo una importa. Afirmar sobre el 200 daría un fallo
 * permanente sobre algo que funciona; no afirmar nada dejaría sin cubrir la
 * única pregunta que cuenta — si Mallory puede tocar la fila de Bob.
 */
if (notiId) {
  await api(`/api/notifications/${notiId}`, { actor: mallory, method: 'PATCH' });
  const tras = await api('/api/notifications', { actor: bob });
  const noti = (tras.json?.notifications ?? []).find((n) => n.id === notiId);
  check('la notificación de Bob sigue sin leer tras el intento ajeno', noti?.readAt ?? null, null);

  // Control positivo: el dueño sí puede, o la comprobación de arriba pasaría
  // igual si «marcar leído» estuviera roto para todo el mundo.
  await api(`/api/notifications/${notiId}`, { actor: bob, method: 'PATCH' });
  const propia = await api('/api/notifications', { actor: bob });
  const leida = (propia.json?.notifications ?? []).find((n) => n.id === notiId);
  check('el dueño sí la marca leída', Boolean(leida?.readAt), true);
}

// El perfil por nombre de usuario es público a propósito (hace falta para
// buscar gente), pero no debe filtrar el correo ni nada de la fila interna.
const perfil = await api(`/api/users/${bob.email.split('@')[0].replace(/[^a-z0-9_]/gi, '')}`, { actor: mallory });
const fuga = JSON.stringify(perfil.json ?? {});
check('el perfil ajeno no expone el correo', fuga.includes('@probe.test'), false);
check('el perfil ajeno no expone hash de contraseña', /password|hash/i.test(fuga), false);

// ---------------------------------------------------------------------------
// 4. Control positivo: las mismas operaciones sí funcionan para quien manda
// ---------------------------------------------------------------------------
console.log('\ncontrol positivo — sin esto, un 403 universal pasaría por seguridad:');

check('la dueña sí lee la conversación', (await api(`/api/conversations/${grupoId}`, { actor: alice })).status, 200);
check('la dueña sí renombra', (await api(`/api/conversations/${grupoId}`, { actor: alice, method: 'PATCH', body: { name: 'Sala renombrada' } })).status, 200);
check('el miembro sí lee los mensajes', (await api(`/api/conversations/${grupoId}/messages`, { actor: bob })).status, 200);
check('el miembro sí reacciona', (await api(`/api/messages/${mensajeId}/reactions`, { actor: bob, method: 'POST', body: { emoji: '👍' } })).status, 200);
check('la dueña sí marca leído', (await api(`/api/conversations/${grupoId}/read`, { actor: alice, method: 'POST', body: { messageId: mensajeId } })).status, 200);
check('la dueña sí crea invitación', (await api(`/api/conversations/${grupoId}/invites`, { actor: alice, method: 'POST', body: { expiresInHours: 1 } })).status, 201);

await cleanup();
console.log('\ncuentas de prueba borradas');
