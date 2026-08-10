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
import { api, check, cleanup, makeUser, onboard, requireServer } from './harness.mjs';

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

await cleanup();
console.log('\ncuentas de prueba borradas');
