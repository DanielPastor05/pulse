/**
 * Escalada de privilegios, mass assignment, y qué hace la aplicación cuando le
 * mandas basura.
 *
 *   E2E_APP_URL=https://… node tests/e2e/abuse.mjs
 *
 * `authorization.mjs` pregunta «¿puede Mallory hacer X?». Esto pregunta algo
 * distinto: «¿puede alguien que **sí** tiene un sitio dentro conseguir más de
 * lo que le toca?». Son fallos de otra familia — no se saltan una comprobación,
 * la aprovechan.
 *
 * Todo lo que se afirma aquí sale de ejecutarlo contra el servidor, no de leer
 * el validador. Un `z.enum` que excluye `OWNER` es una buena señal y no una
 * demostración: hay que mandar el `OWNER` y ver qué contesta.
 */
import { api, check, cleanup, makeUser, onboard, requireServer } from './harness.mjs';

await requireServer();

const RECHAZADO = [400, 401, 403, 404, 422];

function niega(etiqueta, resultado) {
  const ok = RECHAZADO.includes(resultado.status);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${etiqueta} -> ${resultado.status}`);
  if (!ok) {
    process.exitCode = 1;
    console.log(`        cuerpo: ${JSON.stringify(resultado.json).slice(0, 200)}`);
  }
}

console.log('\npreparando…');
const alice = await makeUser('alice');
const bob = await makeUser('bob');
await Promise.all([onboard(alice), onboard(bob)]);

const grupo = await api('/api/conversations', {
  actor: alice,
  method: 'POST',
  body: { type: 'GROUP', name: 'Sala de abuso', memberIds: [bob.id] },
});
const grupoId = grupo.json?.id ?? grupo.json?.conversation?.id;
check('el grupo se crea', grupo.status, 201);

// ---------------------------------------------------------------------------
// 1. Escalada de privilegios
// ---------------------------------------------------------------------------
console.log('\nnadie se asciende a sí mismo:');

niega('un MEMBER se hace ADMIN', await api(`/api/conversations/${grupoId}/members/${bob.id}`, {
  actor: bob, method: 'PATCH', body: { role: 'ADMIN' },
}));

niega('un MEMBER se hace OWNER por el rol', await api(`/api/conversations/${grupoId}/members/${bob.id}`, {
  actor: bob, method: 'PATCH', body: { role: 'OWNER' },
}));

// Ahora Bob sí es ADMIN, puesto por quien puede. La pregunta es si desde ahí
// puede dar el último salto — que es donde el `z.enum` tiene que sostener.
const asciende = await api(`/api/conversations/${grupoId}/members/${bob.id}`, {
  actor: alice, method: 'PATCH', body: { role: 'ADMIN' },
});
check('la dueña sí asciende a Bob a ADMIN', asciende.status, 200);

niega('un ADMIN se corona OWNER', await api(`/api/conversations/${grupoId}/members/${bob.id}`, {
  actor: bob, method: 'PATCH', body: { role: 'OWNER' },
}));

niega('un ADMIN degrada a la dueña', await api(`/api/conversations/${grupoId}/members/${alice.id}`, {
  actor: bob, method: 'PATCH', body: { role: 'MEMBER' },
}));

niega('un ADMIN se transfiere la propiedad', await api(`/api/conversations/${grupoId}/owner`, {
  actor: bob, method: 'POST', body: { userId: bob.id },
}));

// El rol de verdad, leído del servidor. Sin esto, todos los 403 de arriba
// podrían convivir con un cambio que sí se aplicó por otra vía.
const detalle = await api(`/api/conversations/${grupoId}`, { actor: alice });
const rolDeAlice = (detalle.json?.members ?? []).find((m) => m.user?.id === alice.id)?.role;
check('la dueña sigue siendo OWNER al final', rolDeAlice, 'OWNER');

// ---------------------------------------------------------------------------
// 2. Mass assignment
// ---------------------------------------------------------------------------
console.log('\nlos campos que no se piden se ignoran:');

const antes = await api('/api/me', { actor: bob });
const idAntes = antes.json?.user?.id ?? antes.json?.id;

const inyecta = await api('/api/me', {
  actor: bob,
  method: 'PATCH',
  body: {
    displayName: 'Bob',
    // Todo lo que sigue no está en el esquema. Zod los descarta en vez de
    // pasarlos a Prisma; si alguno llegara, aquí se vería.
    id: alice.id,
    role: 'ADMIN',
    isAdmin: true,
    onboardedAt: null,
    email: 'secuestrado@probe.test',
    createdAt: '1970-01-01T00:00:00.000Z',
  },
});
check('la petición con campos de más no revienta', inyecta.status, 200);

const despues = await api('/api/me', { actor: bob });
const yo = despues.json?.user ?? despues.json;
check('el id no cambió', yo?.id, idAntes);
check('el correo no cambió', yo?.email?.includes('secuestrado'), false);
check('sigue estando dado de alta', Boolean(yo?.onboardedAt), true);

// ---------------------------------------------------------------------------
// 3. Bloqueos: perder el acceso tiene que notarse
// ---------------------------------------------------------------------------
console.log('\nbloquear a alguien le quita el paso:');

const directo = await api('/api/conversations/direct', {
  actor: alice, method: 'POST', body: { userId: bob.id },
});
const directoId = directo.json?.id ?? directo.json?.conversation?.id;
check('el directo existe', Boolean(directoId), true);

check('Bob escribe antes del bloqueo', (await api(`/api/conversations/${directoId}/messages`, {
  actor: bob, method: 'POST', body: { content: 'hola antes del bloqueo', clientId: 'ab-1' },
})).status, 201);

check('Alice bloquea a Bob', (await api('/api/blocks', {
  actor: alice, method: 'POST', body: { userId: bob.id, blocked: true },
})).status, 200);

niega('Bob escribe después del bloqueo', await api(`/api/conversations/${directoId}/messages`, {
  actor: bob, method: 'POST', body: { content: 'y despues?', clientId: 'ab-2' },
}));

// ---------------------------------------------------------------------------
// 4. Entradas hostiles: que el error sea un error, no una fuga
// ---------------------------------------------------------------------------
console.log('\nla basura se rechaza sin contar de más:');

const fea = [
  ['un array donde va un texto', { content: ['a', 'b'], clientId: 'x-1' }],
  ['un objeto donde va un texto', { content: { $ne: null }, clientId: 'x-2' }],
  ['null donde va un texto', { content: null, clientId: 'x-3' }],
  ['un número donde va un texto', { content: 12345, clientId: 'x-4' }],
  ['contenido vacío', { content: '', clientId: 'x-5' }],
  ['un mensaje de 100 000 caracteres', { content: 'A'.repeat(100_000), clientId: 'x-6' }],
];

for (const [etiqueta, body] of fea) {
  niega(etiqueta, await api(`/api/conversations/${grupoId}/messages`, { actor: alice, method: 'POST', body }));
}

/*
 * `clientId` es opcional a propósito, y conviene decir qué implica.
 *
 * La garantía de «un reintento no duplica» se apoya en un índice único sobre
 * esa columna, así que **sólo vale cuando el cliente manda la clave**. Un
 * cliente que la omita puede publicar dos veces lo mismo. No es un fallo de
 * seguridad —el envío está limitado por cuota y sólo se afecta a sí mismo—
 * pero es una precondición que la garantía no enuncia.
 *
 * Se afirma el contrato real: sin clave se acepta, con clave se deduplica.
 */
console.log('\nla idempotencia depende de que el cliente mande la clave:');

check('sin clientId se acepta', (await api(`/api/conversations/${grupoId}/messages`, {
  actor: alice, method: 'POST', body: { content: 'sin clave de cliente' },
})).status, 201);

const clave = `dedupe-${Date.now()}`;
const primera = await api(`/api/conversations/${grupoId}/messages`, {
  actor: alice, method: 'POST', body: { content: 'con clave', clientId: clave },
});
const segunda = await api(`/api/conversations/${grupoId}/messages`, {
  actor: alice, method: 'POST', body: { content: 'con clave', clientId: clave },
});
check('el reintento con la misma clave no da error', segunda.status < 400, true);
check('y devuelve el mismo mensaje, no uno nuevo',
  (segunda.json?.id ?? segunda.json?.message?.id), (primera.json?.id ?? primera.json?.message?.id));

/*
 * Regresión de AUDIT-01.
 *
 * Un id que no es un uuid devolvía **500** en once de las trece rutas con id.
 * No filtraba nada, pero cada petición basura entraba en Sentry como
 * incidencia y en los percentiles como latencia real: con un bucle se agota la
 * cuota del reporte de errores desde cualquier cuenta con sesión.
 *
 * Se recorren varias rutas y no una: era un fallo del manejador compartido, y
 * comprobar sólo una dejaría que volviera por cualquiera de las otras diez.
 */
console.log('\nun id malformado no es un fallo del servidor:');

const CON_ID = [
  ['GET', `/api/conversations/${'no-soy-un-uuid'}`],
  ['GET', `/api/conversations/${'no-soy-un-uuid'}/messages`],
  ['GET', `/api/conversations/${'no-soy-un-uuid'}/gallery`],
  ['GET', `/api/messages/${'no-soy-un-uuid'}/thread`],
  ['DELETE', `/api/messages/${'no-soy-un-uuid'}`],
  ['DELETE', `/api/relationships/${'no-soy-un-uuid'}`],
  ['PATCH', `/api/notifications/${'no-soy-un-uuid'}`],
];

for (const [metodo, path] of CON_ID) {
  const r = await api(path, { actor: alice, method: metodo });
  const ok = r.status < 500;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${metodo} ${path.replace('no-soy-un-uuid', ':basura')} -> ${r.status}`);
  if (!ok) process.exitCode = 1;
}

const idRaro = await api('/api/conversations/no-soy-un-uuid', { actor: alice });
const cuerpoRaro = JSON.stringify(idRaro.json ?? {});
check('el error no filtra rastro de pila', /at \w+ \(|node_modules|prisma\.|\.ts:\d+/.test(cuerpoRaro), false);
check('el error no filtra SQL', /SELECT |INSERT |WHERE |relation "/.test(cuerpoRaro), false);
check('el error no nombra la tabla', /conversations|messages|users/.test(cuerpoRaro), false);

// JSON roto: va sin pasar por `api()`, que serializa siempre bien.
const roto = await fetch(`${process.env.E2E_APP_URL ?? 'http://localhost:3000'}/api/conversations`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{"type":"GROUP", esto no es json',
});
check('el JSON roto no da 500', roto.status < 500, true);

/*
 * Regresión de AUDIT-08: la autorización va antes que la validación.
 *
 * Un endpoint que valida el cuerpo primero le contesta a un desconocido con un
 * 400 y el detalle del esquema — le cuenta qué campos acepta una ruta a la que
 * no tiene acceso. Es información, no una puerta abierta, pero durante la
 * propia auditoría hizo algo peor: ocho endpoints parecieron probados cuando lo
 * que respondía era el validador y la comprobación de permisos no llegó a
 * ejecutarse nunca.
 *
 * Cada caso lleva su control positivo al lado, porque «403» a secas no
 * demuestra el orden: un endpoint que siempre respondiera 403 lo pasaría igual.
 * Hay que ver las dos respuestas — 403 para quien no es miembro, 400 para quien
 * sí lo es con el mismo cuerpo malo.
 */
console.log('\nquien no es miembro no se entera de la forma del cuerpo:');

const mallory = await makeUser('mallory');
await onboard(mallory);

const CUERPOS_MALOS = [
  ['PATCH', '', { name: 'x' }],                            // min 2
  ['POST', '/members', { userIds: [] }],                   // min 1
  ['POST', '/read', { messageId: 'no-soy-un-uuid' }],      // no es uuid
  ['POST', '/invites', { maxUses: 99_999 }],               // max 1000
];

for (const [metodo, sufijo, body] of CUERPOS_MALOS) {
  const path = `/api/conversations/${grupoId}${sufijo}`;
  const ajena = await api(path, { actor: mallory, method: metodo, body });
  const propia = await api(path, { actor: alice, method: metodo, body });

  const ok = ajena.status === 403 && propia.status === 400;
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'}  ${metodo} ${sufijo || '/'} -> ajena ${ajena.status}, miembro ${propia.status}`,
  );
  if (!ok) {
    process.exitCode = 1;
    console.log(`        ajena: ${JSON.stringify(ajena.json).slice(0, 160)}`);
  }

  // Y que el 403 vaya de verdad sin detalles: el `details` de Zod es
  // exactamente lo que no debe cruzar.
  check(`el 403 de ${metodo} ${sufijo || '/'} no lleva el esquema`,
    Boolean(ajena.json?.details), false);
}

/*
 * Y el contrario, que es el que casi se rompe.
 *
 * Adelantar la comprobación de pertenencia se aplicó a nueve manejadores; el
 * décimo candidato era `/join`, al que por definición llama **quien todavía no
 * es miembro**. Con la guarda puesta ahí, unirse a un grupo público habría
 * devuelto 403 para siempre. Nada lo cubría, así que se habría desplegado.
 */
console.log('\ny unirse a un grupo público sigue siendo posible sin ser miembro:');

const publico = await api('/api/conversations', {
  actor: alice, method: 'POST', body: { type: 'GROUP', name: 'Sala abierta' },
});
const publicoId = publico.json?.id ?? publico.json?.conversation?.id;

check('el grupo se abre al público', (await api(`/api/conversations/${publicoId}`, {
  actor: alice, method: 'PATCH', body: { isPublic: true, requiresApproval: false },
})).status, 200);

const seUne = await api(`/api/conversations/${publicoId}/join`, {
  actor: mallory, method: 'POST', body: {},
});
check('alguien de fuera se une', seUne.status < 400, true);
if (seUne.status >= 400) {
  console.log(`        cuerpo: ${JSON.stringify(seUne.json).slice(0, 200)}`);
}

// El efecto, no el código de estado: unirse tiene que dejarle leer.
check('y a partir de ahí puede leer la sala',
  (await api(`/api/conversations/${publicoId}/messages`, { actor: mallory })).status, 200);

/*
 * El catálogo de GIF y stickers sólo admite sus dos valores.
 *
 * Se comprueba aquí y no en el selector porque el fallo que hubo era del
 * servidor y de la misma familia que AUDIT-04: el corte por «Tenor no está
 * configurado» iba **delante** de la validación, así que sin clave un `kind`
 * inventado devolvía 200 y la comprobación no llegaba a ejecutarse. La respuesta
 * a una petición mal formada no puede depender de una variable de entorno.
 */
console.log('\nel catálogo de GIF sólo admite sus dos valores:');

for (const kind of ['gif', 'sticker']) {
  const r = await api(`/api/gifs?kind=${kind}`, { actor: alice });
  const ok = r.status === 200 && typeof r.json?.configured === 'boolean';
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  kind=${kind} -> ${r.status} (configurado: ${r.json?.configured})`);
  if (!ok) process.exitCode = 1;
}

for (const kind of ['pegatina', 'GIF', '', 'sticker,gif']) {
  const r = await api(`/api/gifs?kind=${encodeURIComponent(kind)}`, { actor: alice });
  // `''` no es un valor inválido: el esquema tiene `.default('gif')` y una
  // cadena vacía en la URL es equivalente a no mandar el parámetro.
  const esperado = kind === '' ? 200 : 400;
  const ok = r.status === esperado;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  kind=«${kind}» -> ${r.status} (esperado ${esperado})`);
  if (!ok) process.exitCode = 1;
}

await cleanup();
console.log('\ncuentas de prueba borradas');
