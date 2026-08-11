/**
 * Guarantees that were broken once and must not break again.
 *
 * 1. Blocking someone stops them putting you in a room with them. Filtering
 *    only direct messages left the block cosmetic: create a group, add the
 *    person who blocked you, and you are talking to them again.
 * 2. The rate limiter actually rejects. It lives in Postgres precisely so the
 *    count survives more than one instance.
 * 3. Storage rejects a disallowed type even when the client lies about it —
 *    the app-side check runs when the signed URL is issued, but the client
 *    sets Content-Type itself on the upload.
 */
import { api, APP, check, cleanup, makeUser, onboard, requireServer } from './harness.mjs';

await requireServer();

const alice = await makeUser('alice');
const mallory = await makeUser('mallory');
await onboard(alice);
await onboard(mallory);

// --- 1. Bloqueo -------------------------------------------------------------
console.log('\nBloqueo: Alice bloquea a Mallory');

const blocked = await api('/api/blocks', {
  method: 'POST',
  actor: alice,
  body: { userId: mallory.id, blocked: true },
});
check('la peticion de bloqueo', blocked.status, 200);

const group = await api('/api/conversations', {
  method: 'POST',
  actor: mallory,
  body: { name: 'Hola otra vez', accent: 'electric', memberIds: [alice.id] },
});
const conversation = group.json?.conversation ?? group.json;
const conversationId = conversation?.id;

const holdsAlice = (payload) =>
  (payload?.members ?? []).some((member) => (member.userId ?? member.user?.id) === alice.id);

check('Alice dentro del grupo recien creado', holdsAlice(conversation), false);

const added = await api(`/api/conversations/${conversationId}/members`, {
  method: 'POST',
  actor: mallory,
  body: { userIds: [alice.id] },
});
check('Alice dentro tras /members', holdsAlice(added.json?.conversation ?? added.json), false);

const inbox = await api('/api/conversations', { actor: alice });
const list = inbox.json?.conversations ?? inbox.json ?? [];
check(
  'la conversacion aparece en la bandeja de Alice',
  Array.isArray(list) && list.some((item) => item.id === conversationId),
  false,
);

// --- 2. Rate limit ----------------------------------------------------------
console.log('\nRate limit: 35 envios simultaneos, limite 25 por 10s');

const own = await api('/api/conversations', {
  method: 'POST',
  actor: mallory,
  body: { name: 'Sala de pruebas', accent: 'electric', memberIds: [] },
});
const ownId = (own.json?.conversation ?? own.json)?.id;

const results = await Promise.all(
  Array.from({ length: 35 }, (_, i) =>
    api(`/api/conversations/${ownId}/messages`, {
      method: 'POST',
      actor: mallory,
      body: { content: `carga ${i}` },
    }),
  ),
);
const codes = results.map((result) => result.status);
check('aceptados (201)', codes.filter((code) => code === 201).length, 25);
check('rechazados (429)', codes.filter((code) => code === 429).length, 10);
check('errores del servidor (500)', codes.filter((code) => code >= 500).length, 0);

// --- 3. Tipos MIME ----------------------------------------------------------
console.log('\nSubidas: tipo peligroso y Content-Type falseado');

const svg = await api('/api/uploads', {
  method: 'POST',
  actor: mallory,
  body: { bucket: 'attachments', fileName: 'x.svg', mimeType: 'image/svg+xml', size: 100 },
});
check('la app firma una URL para image/svg+xml', svg.status, 400);

const signed = await api('/api/uploads', {
  method: 'POST',
  actor: mallory,
  body: { bucket: 'attachments', fileName: 'ok.png', mimeType: 'image/png', size: 100 },
});
check('la app firma una URL para image/png', signed.status, 200);

if (signed.status === 200) {
  const put = await fetch(signed.json.signedUrl, {
    method: 'PUT',
    headers: {
      'content-type': 'text/html',
      authorization: `Bearer ${mallory.session.access_token}`,
    },
    body: '<script>alert(document.domain)</script>',
  });
  check('Storage acepta HTML disfrazado de PNG', put.ok, false);
}

// El caso legitimo: si esto falla, nadie puede mandar una foto.
const realPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const forPhoto = await api('/api/uploads', {
  method: 'POST',
  actor: mallory,
  body: { bucket: 'attachments', fileName: 'foto.png', mimeType: 'image/png', size: realPng.length },
});
check('la app firma la subida de una foto', forPhoto.status, 200);

if (forPhoto.status === 200) {
  const uploaded = await fetch(forPhoto.json.signedUrl, {
    method: 'PUT',
    headers: {
      'content-type': 'image/png',
      authorization: `Bearer ${mallory.session.access_token}`,
    },
    body: realPng,
  });
  check('Storage acepta un PNG de verdad', uploaded.ok, true);

  // Y tiene que poder verse despues: el bucket es de lectura publica.
  const fetched = await fetch(forPhoto.json.publicUrl);
  check('la imagen subida se puede descargar', fetched.status, 200);
  check(
    'y se sirve como imagen',
    (fetched.headers.get('content-type') ?? '').startsWith('image/'),
    true,
  );
}

// --- 4. Enlaces de invitacion ----------------------------------------------
console.log('\nInvitaciones: el enlace apunta al dominio real');

const invite = await api(`/api/conversations/${ownId}/invites`, {
  method: 'POST',
  actor: mallory,
  body: { maxUses: 1, expiresInHours: 1 },
});
check('crear la invitacion', invite.status, 201);

// Salio apuntando a un dominio de configuracion que no era el desplegado, y el
// enlace daba 404 sin que nada fallara antes.
const inviteUrl = invite.json?.url ?? '';
check('el origen del enlace es el del propio servidor', new URL(inviteUrl).origin, APP);

const followed = await fetch(inviteUrl, { redirect: 'manual' });
check('el enlace no da 404', followed.status === 404, false);

// --- 5. Propiedad de un grupo ----------------------------------------------
console.log('\nPropiedad: el dueño tiene que poder ceder el grupo y salir');

const owned = await api('/api/conversations', {
  method: 'POST',
  actor: alice,
  body: { name: 'Grupo con dueño', accent: 'electric', memberIds: [] },
});
const ownedId = (owned.json?.conversation ?? owned.json)?.id;

// Se necesita un segundo miembro sin bloqueos de por medio.
const dana = await makeUser('dana');
await onboard(dana);
await api(`/api/conversations/${ownedId}/members`, {
  method: 'POST',
  actor: alice,
  body: { userIds: [dana.id] },
});

// El dueño no puede irse dejando el grupo sin nadie al mando.
const leaveTooSoon = await api(`/api/conversations/${ownedId}/members/${alice.id}`, {
  method: 'DELETE',
  actor: alice,
});
check('el dueño sale sin ceder antes', leaveTooSoon.status === 200, false);

// Y un miembro raso no puede autoproclamarse.
const grab = await api(`/api/conversations/${ownedId}/owner`, {
  method: 'POST',
  actor: dana,
  body: { userId: dana.id },
});
check('un miembro se hace dueño por su cuenta', grab.status === 200, false);

const handover = await api(`/api/conversations/${ownedId}/owner`, {
  method: 'POST',
  actor: alice,
  body: { userId: dana.id },
});
check('el dueño cede el grupo', handover.status, 200);

const roleOf = (payload, userId) =>
  (payload?.members ?? []).find((m) => (m.userId ?? m.user?.id) === userId)?.role ?? null;
const after = handover.json?.conversation ?? handover.json;
check('Dana pasa a OWNER', roleOf(after, dana.id), 'OWNER');
check('Alice queda como ADMIN', roleOf(after, alice.id), 'ADMIN');

// Y ahora sí puede salir.
const leaveNow = await api(`/api/conversations/${ownedId}/members/${alice.id}`, {
  method: 'DELETE',
  actor: alice,
});
check('la antigua dueña ya puede salir', leaveNow.status, 200);

// Dueño único: salir equivale a borrar el grupo, no a quedarse atrapado.
const solo = await api('/api/conversations', {
  method: 'POST',
  actor: dana,
  body: { name: 'Grupo de una', accent: 'electric', memberIds: [] },
});
const soloId = (solo.json?.conversation ?? solo.json)?.id;
const leaveSolo = await api(`/api/conversations/${soloId}/members/${dana.id}`, {
  method: 'DELETE',
  actor: dana,
});
check('el dueño único puede salir de su grupo vacío', leaveSolo.status, 200);

const gone = await api(`/api/conversations/${soloId}`, { actor: dana });
check('y el grupo deja de existir', gone.status === 404 || gone.status === 403, true);

await cleanup();
console.log('\ncuentas de prueba borradas');
