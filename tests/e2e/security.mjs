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

// --- 4b. Idempotencia del envio --------------------------------------------
// Es la garantia sobre la que se apoya el boton de reintentar: si se rompiera,
// reintentar publicaria el mensaje dos veces en vez de una.
console.log('\nEnvio: reintentar con el mismo clientId no duplica');

const idemConv = await api('/api/conversations', {
  method: 'POST',
  actor: mallory,
  body: { name: 'Sala idempotente', accent: 'electric', memberIds: [] },
});
const idemId = (idemConv.json?.conversation ?? idemConv.json)?.id;
const clientId = `pending-${Date.now()}`;
const cuerpo = { content: 'Mensaje que se reintenta', clientId };

const primera = await api(`/api/conversations/${idemId}/messages`, {
  method: 'POST',
  actor: mallory,
  body: cuerpo,
});
check('el primer envio entra', primera.status, 201);

const reintento = await api(`/api/conversations/${idemId}/messages`, {
  method: 'POST',
  actor: mallory,
  body: cuerpo,
});
check('el reintento no da error', reintento.status === 201 || reintento.status === 200, true);

const historial = await api(`/api/conversations/${idemId}/messages`, { actor: mallory });
const mios = (historial.json?.items ?? []).filter((m) => m.content === 'Mensaje que se reintenta');
check('cuantas copias hay en el historial', mios.length, 1);

// Y el caso que de verdad ocurre: dos intentos a la vez, que esquivan la
// consulta previa y chocan contra la restriccion unica.
const carreraId = `pending-carrera-${Date.now()}`;
const simultaneos = await Promise.all(
  Array.from({ length: 4 }, () =>
    api(`/api/conversations/${idemId}/messages`, {
      method: 'POST',
      actor: mallory,
      body: { content: 'Cuatro a la vez', clientId: carreraId },
    }),
  ),
);
check(
  'ninguno de los cuatro simultaneos falla',
  simultaneos.filter((r) => r.status >= 400).length,
  0,
);

const trasCarrera = await api(`/api/conversations/${idemId}/messages`, { actor: mallory });
const copias = (trasCarrera.json?.items ?? []).filter((m) => m.content === 'Cuatro a la vez');
check('copias tras cuatro envios simultaneos', copias.length, 1);

// --- 4c. Previsualizacion de enlaces ---------------------------------------
// Las funciones puras ya tienen prueba unitaria; esto verifica el camino
// completo, que es donde un fallo de verdad expondria la red interna.
console.log('\nEnlaces: el servidor no va a buscar direcciones internas');

async function previewOf(texto) {
  const enviado = await api(`/api/conversations/${idemId}/messages`, {
    method: 'POST',
    actor: mallory,
    body: { content: texto },
  });
  if (enviado.status !== 201) throw new Error(`envio -> ${enviado.status}`);
  // La resolucion ocurre despues de la respuesta, a proposito.
  await new Promise((resolve) => setTimeout(resolve, 2_500));
  const historial = await api(`/api/conversations/${idemId}/messages`, { actor: mallory });
  const encontrado = (historial.json?.items ?? []).find((m) => m.id === (enviado.json?.id ?? ''));
  return encontrado?.linkPreview ?? null;
}

check('previsualiza http://127.0.0.1/admin', await previewOf('mira http://127.0.0.1/admin'), null);
check(
  'previsualiza la IP de metadatos de la nube',
  await previewOf('mira http://169.254.169.254/latest/meta-data/'),
  null,
);
check('previsualiza una IP privada', await previewOf('mira http://192.168.1.1/'), null);
check('previsualiza ::1', await previewOf('mira http://[::1]:8080/'), null);

// Control positivo. Sin el, cuatro «null» saldrian igual si la funcion entera
// estuviera rota, y las cuatro comprobaciones de arriba no valdrian nada.
//
// El objetivo es la propia app en lugar de un tercero: es HTML con etiquetas
// meta de verdad, siempre esta disponible, y ningun sitio ajeno puede volver
// la prueba intermitente bloqueando al robot o cambiando su portada.
// Solo corre contra produccion: en local el servidor no resuelve DNS externo,
// y ahi un null no distingue «bloqueado» de «sin red».
if (APP.includes('localhost')) {
  console.log('  --    control positivo omitido: el servidor local no resuelve DNS externo');
} else {
  const real = await previewOf(`mira ${APP}/login`);
  check('un enlace publico sí produce tarjeta', real !== null, true);
  check('y trae titulo', typeof real?.title === 'string' && real.title.length > 0, true);
  check(
    'y trae descripcion',
    typeof real?.description === 'string' && real.description.length > 0,
    true,
  );
}

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

// --- 6. Denuncias ----------------------------------------------------------
console.log('\nDenuncias: cualquiera denuncia, solo quien modera las ve');

const sala = await api('/api/conversations', {
  method: 'POST',
  actor: dana,
  body: { name: 'Sala moderada', accent: 'electric', memberIds: [] },
});
const salaId = (sala.json?.conversation ?? sala.json)?.id;

const raso = await makeUser('raso');
await onboard(raso);
await api(`/api/conversations/${salaId}/members`, {
  method: 'POST',
  actor: dana,
  body: { userIds: [raso.id] },
});

const ofensivo = await api(`/api/conversations/${salaId}/messages`, {
  method: 'POST',
  actor: dana,
  body: { content: 'mensaje que alguien denuncia' },
});
const ofensivoId = ofensivo.json?.id;

const propio = await api(`/api/messages/${ofensivoId}/report`, {
  method: 'POST',
  actor: dana,
  body: { reason: 'SPAM' },
});
check('se puede denunciar el mensaje propio', propio.status === 201, false);

const denuncia = await api(`/api/messages/${ofensivoId}/report`, {
  method: 'POST',
  actor: raso,
  body: { reason: 'HARASSMENT', note: 'me incomoda' },
});
check('un miembro raso puede denunciar', denuncia.status, 201);

// Denunciar dos veces no debe apilar entradas para el moderador.
await api(`/api/messages/${ofensivoId}/report`, {
  method: 'POST',
  actor: raso,
  body: { reason: 'SPAM' },
});

const comoRaso = await api(`/api/conversations/${salaId}/reports`, { actor: raso });
check('un miembro raso ve la cola de denuncias', comoRaso.status === 200, false);

const comoMod = await api(`/api/conversations/${salaId}/reports`, { actor: dana });
check('quien modera sí la ve', comoMod.status, 200);
check('y hay una sola entrada tras denunciar dos veces', (comoMod.json?.reports ?? []).length, 1);

const abierta = (comoMod.json?.reports ?? [])[0];
check('conserva el texto denunciado', abierta?.message?.content, 'mensaje que alguien denuncia');

const revisadaPorRaso = await api(`/api/reports/${abierta?.id}`, {
  method: 'PATCH',
  actor: raso,
  body: { status: 'RESOLVED' },
});
check('un miembro raso resuelve denuncias', revisadaPorRaso.status === 200, false);

const revisada = await api(`/api/reports/${abierta?.id}`, {
  method: 'PATCH',
  actor: dana,
  body: { status: 'RESOLVED' },
});
check('quien modera puede resolverla', revisada.status, 200);

const trasResolver = await api(`/api/conversations/${salaId}/reports`, { actor: dana });
check('sale de la cola de abiertas', (trasResolver.json?.reports ?? []).length, 0);

// --- 5b. Credenciales TURN --------------------------------------------------
console.log('\nTURN: se acuñan en el servidor y el token no baja al cliente');

const sinSesion = await fetch(`${APP}/api/calls/ice`);
check('un anonimo obtiene credenciales', sinSesion.status === 200, false);

const conSesion = await api('/api/calls/ice', { actor: dana });
check('un usuario con sesion sí', conSesion.status, 200);

const servidores = conSesion.json?.iceServers ?? [];
check('devuelve servidores ICE', servidores.length > 0, true);

const conTurn = servidores.filter((s) =>
  (Array.isArray(s.urls) ? s.urls : [s.urls]).some((u) => String(u).startsWith('turn')),
);
if (conTurn.length > 0) {
  check(
    'las entradas TURN traen usuario y credencial',
    conTurn.every((s) => Boolean(s.username) && Boolean(s.credential)),
    true,
  );
} else {
  console.log('  --    sin relay configurado en este entorno; sólo se comprueba el fallback STUN');
}

// Lo que de verdad protege esta ruta: el token que gasta la cuota se queda
// dentro. Si algún día alguien "simplifica" devolviendo la respuesta cruda de
// Cloudflare, esto se pone rojo.
const cuerpoIce = JSON.stringify(conSesion.json ?? {});
check(
  'la respuesta no contiene nada con pinta de token de cuenta',
  /[a-f0-9]{32,}/i.test(cuerpoIce.replace(/"(username|credential)":"[^"]*"/g, '')),
  false,
);

// --- 6a. Hilos --------------------------------------------------------------
console.log('\nHilos: se cuentan las respuestas y no se filtran entre conversaciones');

const salaHilo = await api('/api/conversations', {
  method: 'POST',
  actor: dana,
  body: { name: 'Sala con hilos', accent: 'electric', memberIds: [] },
});
const hiloConvId = (salaHilo.json?.conversation ?? salaHilo.json)?.id;

const raiz = await api(`/api/conversations/${hiloConvId}/messages`, {
  method: 'POST',
  actor: dana,
  body: { content: '¿Alguien se apunta el sábado?' },
});
const raizId = raiz.json?.id;

for (const texto of ['Yo sí', 'Yo también', 'Depende de la hora']) {
  await api(`/api/conversations/${hiloConvId}/messages`, {
    method: 'POST',
    actor: dana,
    body: { content: texto, replyToId: raizId },
  });
}

const hilo = await api(`/api/messages/${raizId}/thread`, { actor: dana });
check('cargar el hilo', hilo.status, 200);
check('trae las tres respuestas', (hilo.json?.replies ?? []).length, 3);
check('y la raíz correcta', hilo.json?.root?.id, raizId);

const historialHilo = await api(`/api/conversations/${hiloConvId}/messages`, { actor: dana });
const raizEnLista = (historialHilo.json?.items ?? []).find((m) => m.id === raizId);
check('el contador aparece en la conversación', raizEnLista?.replyCount, 3);

// Las respuestas siguen visibles en el hilo principal: el panel enfoca una
// rama, no la esconde.
check(
  'las respuestas no desaparecen de la conversación',
  (historialHilo.json?.items ?? []).filter((m) => m.replyTo?.id === raizId).length,
  3,
);

const ajenoHilo = await api(`/api/messages/${raizId}/thread`, { actor: alice });
check('alguien de fuera puede leer el hilo', ajenoHilo.status === 200, false);

// --- 6b. Encuestas ----------------------------------------------------------
console.log('\nEncuestas: un voto por encuesta, y cambiar de idea no acumula');

const salaEncuesta = await api('/api/conversations', {
  method: 'POST',
  actor: dana,
  body: { name: 'Dónde cenamos', accent: 'electric', memberIds: [] },
});
const encuestaConvId = (salaEncuesta.json?.conversation ?? salaEncuesta.json)?.id;

const invalida = await api(`/api/conversations/${encuestaConvId}/polls`, {
  method: 'POST',
  actor: dana,
  body: { question: 'Con una sola opción', options: ['única'], multiple: false },
});
check('acepta una encuesta con una sola opción', invalida.status === 201, false);

const creada = await api(`/api/conversations/${encuestaConvId}/polls`, {
  method: 'POST',
  actor: dana,
  body: { question: '¿Dónde cenamos?', options: ['Pizza', 'Sushi', 'Tacos'], multiple: false },
});
check('crear la encuesta', creada.status, 201);
const encuestaMsgId = creada.json?.id;
const opciones = creada.json?.poll?.options ?? [];
check('llega con sus tres opciones', opciones.length, 3);

const votar = (optionId, actor = dana) =>
  api(`/api/messages/${encuestaMsgId}/poll`, { method: 'POST', actor, body: { optionId } });

let estado = await votar(opciones[0]?.id);
check('votar la primera', estado.json?.poll?.totalVotes, 1);

// Cambiar de idea en una encuesta de opción única debe mover el voto, no sumar.
// Es la regla que el índice único no puede expresar: sólo conoce opciones.
estado = await votar(opciones[1]?.id);
check('tras cambiar de opción, votos totales', estado.json?.poll?.totalVotes, 1);
check(
  'y el voto está en la nueva',
  (estado.json?.poll?.options ?? []).find((o) => o.id === opciones[1]?.id)?.votes,
  1,
);

// Volver a pulsar la propia opción retira el voto.
estado = await votar(opciones[1]?.id);
check('volver a pulsar la misma retira el voto', estado.json?.poll?.totalVotes, 0);

const cerrada = await api(`/api/messages/${encuestaMsgId}/poll`, { method: 'PATCH', actor: dana });
check('el autor puede cerrarla', cerrada.status, 200);
check('queda marcada como cerrada', cerrada.json?.poll?.closed, true);

const votoTardio = await votar(opciones[0]?.id);
check('se puede votar una encuesta cerrada', votoTardio.status === 200, false);

// --- 7. Galeria -------------------------------------------------------------
console.log('\nGaleria: sólo miembros, y la paginación no salta ni repite');

const conAdjuntos = await api('/api/conversations', {
  method: 'POST',
  actor: mallory,
  body: { name: 'Sala con fotos', accent: 'electric', memberIds: [] },
});
const galeriaId = (conAdjuntos.json?.conversation ?? conAdjuntos.json)?.id;

// Un PNG real de 1x1, el mismo que usa la prueba de subidas.
const pngBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

// Lo que hay que demostrar es que cruzar el límite de página no salta ni
// repite, y eso es cierto de cualquier límite. Se piden páginas de 4 en vez de
// subir 45 imágenes reales para alcanzar las 40 por defecto, que hacía que la
// suite tardara más de diez minutos contra producción.
const TOTAL = 9;
const PAGINA = 4;
for (let i = 0; i < TOTAL; i++) {
  const firmada = await api('/api/uploads', {
    method: 'POST',
    actor: mallory,
    body: { bucket: 'attachments', fileName: `foto-${i}.png`, mimeType: 'image/png', size: pngBytes.length },
  });
  await fetch(firmada.json.signedUrl, {
    method: 'PUT',
    headers: { 'content-type': 'image/png', authorization: `Bearer ${mallory.session.access_token}` },
    body: pngBytes,
  });
  await api(`/api/conversations/${galeriaId}/messages`, {
    method: 'POST',
    actor: mallory,
    body: {
      content: '',
      attachments: [
        {
          kind: 'IMAGE',
          url: firmada.json.publicUrl,
          path: firmada.json.path,
          name: `foto-${i}.png`,
          size: pngBytes.length,
          mimeType: 'image/png',
        },
      ],
    },
  });
}

const ajeno = await api(`/api/conversations/${galeriaId}/gallery`, { actor: alice });
check('alguien de fuera ve la galeria', ajeno.status === 200, false);

// Paginar hasta el final, acumulando ids.
const vistos = [];
let cursor;
for (let page = 0; page < 10; page++) {
  const url = `/api/conversations/${galeriaId}/gallery?tab=media&limit=${PAGINA}${cursor ? `&cursor=${cursor}` : ''}`;
  const respuesta = await api(url, { actor: mallory });
  if (respuesta.status !== 200) break;
  vistos.push(...(respuesta.json?.items ?? []).map((item) => item.id));
  cursor = respuesta.json?.nextCursor ?? null;
  if (!cursor) break;
}

check('imagenes recorridas en total', vistos.length, TOTAL);
check('sin repetidas entre paginas', new Set(vistos).size, TOTAL);

const soloArchivos = await api(`/api/conversations/${galeriaId}/gallery?tab=files`, {
  actor: mallory,
});
check('la pestaña de archivos no mezcla imagenes', (soloArchivos.json?.items ?? []).length, 0);

await cleanup();
console.log('\ncuentas de prueba borradas');
