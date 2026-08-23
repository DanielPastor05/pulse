/**
 * Los cuatro roles contra los ocho permisos, celda por celda.
 *
 *   E2E_APP_URL=https://… node tests/e2e/role-matrix.mjs
 *
 * La auditoría del 22/08/2026 probó la autorización con tres identidades —
 * dueña, miembro y desconocida— y no encontró una sola filtración. Pero se dejó
 * un hueco que ella misma señaló: **MODERATOR y ADMIN nunca se probaron por
 * separado**. Entre esos dos roles hay cuatro permisos que los distinguen, y un
 * `atLeast(role, 'MODERATOR')` escrito donde tocaba `'ADMIN'` habría pasado
 * inadvertido, porque desde fuera los dos siguen sin ser la dueña.
 *
 * Aquí se recorre la tabla entera: 4 roles × 8 permisos = 32 celdas, cada una
 * ejecutada contra el servidor. Las 24 negaciones exigen **403 exacto**, no un
 * genérico «algo por encima de 400»: un 400 significaría que contestó el
 * validador y el permiso no llegó a mirarse, y un 404 que ni siquiera se
 * resolvió la conversación. Ese matiz no es teórico — es el fallo AUDIT-04, que
 * durante la auditoría hizo pasar por probados a ocho endpoints.
 *
 * Las 8 concesiones son el control positivo de las 24 negaciones: sin ellas,
 * una ruta rota que respondiera 403 a todo el mundo dejaría la tabla en verde.
 */
import { api, check, cleanup, makeUser, onboard, requireServer } from './harness.mjs';

await requireServer();

const ROLES = ['MEMBER', 'MODERATOR', 'ADMIN', 'OWNER'];

console.log('\npreparando…');

const alice = await makeUser('owner');
const actores = {};
for (const rol of ['MEMBER', 'MODERATOR', 'ADMIN']) {
  actores[rol] = await makeUser(rol.toLowerCase());
}
// Alguien a quien ascender o degradar sin tocar a los actores, y tres cuentas
// de repuesto para que cada rol tenga a quien añadir sin pisar a los demás.
const diana = await makeUser('diana');
const repuestos = [await makeUser('rep1'), await makeUser('rep2'), await makeUser('rep3')];

await onboard(alice);
for (const rol of ['MEMBER', 'MODERATOR', 'ADMIN']) await onboard(actores[rol]);
await onboard(diana);
for (const r of repuestos) await onboard(r);

actores.OWNER = alice;

const grupo = await api('/api/conversations', {
  actor: alice,
  method: 'POST',
  body: {
    type: 'GROUP',
    name: 'Matriz de roles',
    memberIds: [actores.MEMBER.id, actores.MODERATOR.id, actores.ADMIN.id, diana.id],
  },
});
const id = grupo.json?.id ?? grupo.json?.conversation?.id;
check('el grupo se crea con todos dentro', grupo.status, 201);

for (const rol of ['MODERATOR', 'ADMIN']) {
  const puesto = await api(`/api/conversations/${id}/members/${actores[rol].id}`, {
    actor: alice,
    method: 'PATCH',
    body: { role: rol },
  });
  check(`la dueña nombra ${rol}`, puesto.status, 200);
}

// El rol leído del servidor, no el que creo haber puesto. Si un ascenso hubiera
// fallado en silencio, toda la matriz de abajo mediría otra cosa.
const detalle = await api(`/api/conversations/${id}`, { actor: alice });
for (const rol of ROLES) {
  const suyo = (detalle.json?.members ?? []).find((m) => m.user?.id === actores[rol].id)?.role;
  check(`${rol} tiene de verdad el rol ${rol}`, suyo, rol);
}

const mensaje = await api(`/api/conversations/${id}/messages`, {
  actor: alice,
  method: 'POST',
  body: { content: 'un mensaje para fijar', clientId: 'rm-1' },
});
const mensajeId = mensaje.json?.id ?? mensaje.json?.message?.id;
check('hay un mensaje que fijar', Boolean(mensajeId), true);

// ---------------------------------------------------------------------------
// La tabla
// ---------------------------------------------------------------------------
/*
 * `minimo` es lo que dice `src/lib/permissions.ts`. Se escribe aquí a mano y no
 * se importa a propósito: importar la misma constante que implementa la regla
 * haría que la prueba pasara siempre, incluso con la regla cambiada. Esto es
 * una segunda declaración de la intención, y el valor está justo en que pueda
 * discrepar.
 */
const PERMISOS = [
  {
    nombre: 'editConversation',
    minimo: 'ADMIN',
    intento: (actor) =>
      api(`/api/conversations/${id}`, { actor, method: 'PATCH', body: { name: `Matriz ${Date.now()}` } }),
  },
  {
    nombre: 'manageMembers',
    minimo: 'MODERATOR',
    // Cada rol añade a un repuesto distinto: si dos compartieran víctima, el
    // segundo chocaría con «ya es miembro» y un 409 se leería como negación.
    intento: (actor, indice) =>
      api(`/api/conversations/${id}/members`, {
        actor,
        method: 'POST',
        body: { userIds: [repuestos[indice % repuestos.length].id] },
      }),
  },
  {
    nombre: 'assignRoles',
    minimo: 'ADMIN',
    intento: (actor) =>
      api(`/api/conversations/${id}/members/${diana.id}`, {
        actor,
        method: 'PATCH',
        body: { role: 'MEMBER' },
      }),
  },
  {
    nombre: 'createInvite',
    minimo: 'MODERATOR',
    intento: (actor) =>
      api(`/api/conversations/${id}/invites`, { actor, method: 'POST', body: { maxUses: 5 } }),
  },
  {
    nombre: 'reviewJoinRequests',
    minimo: 'MODERATOR',
    intento: (actor) => api(`/api/conversations/${id}/join-requests`, { actor }),
  },
  {
    nombre: 'pinMessages',
    minimo: 'MODERATOR',
    intento: (actor) =>
      api(`/api/messages/${mensajeId}/pin`, { actor, method: 'POST', body: { pinned: true } }),
  },
  {
    nombre: 'moderateMessages',
    minimo: 'MODERATOR',
    intento: (actor) => api(`/api/conversations/${id}/moderation-log`, { actor }),
  },
  {
    nombre: 'deleteConversation',
    minimo: 'OWNER',
    // Va la última: la concesión de la dueña borra el grupo.
    intento: (actor) => api(`/api/conversations/${id}`, { actor, method: 'DELETE' }),
  },
];

const ORDEN = { MEMBER: 0, MODERATOR: 1, ADMIN: 2, OWNER: 3 };
const permite = (rol, minimo) => ORDEN[rol] >= ORDEN[minimo];

let celdas = 0;
let mal = 0;

for (const permiso of PERMISOS) {
  console.log(`\n${permiso.nombre} — desde ${permiso.minimo}:`);

  for (const [indice, rol] of ROLES.entries()) {
    const esperado = permite(rol, permiso.minimo);
    const r = await permiso.intento(actores[rol], indice);
    celdas += 1;

    // Concedido: cualquier respuesta de éxito. Negado: 403 y sólo 403.
    const ok = esperado ? r.status < 400 : r.status === 403;
    if (!ok) mal += 1;

    const veredicto = esperado ? 'debe poder' : 'no debe poder';
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${rol.padEnd(9)} ${veredicto} -> ${r.status}`);
    if (!ok) {
      process.exitCode = 1;
      console.log(`        cuerpo: ${JSON.stringify(r.json).slice(0, 160)}`);
    }
  }
}

console.log(`\n${celdas} celdas, ${celdas - mal} correctas, ${mal} mal`);
check('la matriz entera se cumple', mal, 0);

await cleanup();
console.log('\ncuentas de prueba borradas');
