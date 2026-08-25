/**
 * El fondo de conversación, de ida y vuelta contra la instancia desplegada.
 *
 *   E2E_APP_URL=https://… node tests/e2e/preferences.mjs
 *
 * Lo que comprueba y no comprueba nadie más: que el fondo es **de quien mira**.
 * Esa es la razón entera de que la columna viva en la membresía y no en la
 * conversación, y es justo la clase de decisión que un refactor deshace sin
 * darse cuenta — moverla a `Conversation` haría pasar todo lo demás.
 *
 * Y que la lista es cerrada. El valor acaba en un atributo del DOM, así que lo
 * que el servidor acepte es lo que alguien puede escribir ahí.
 */
import { api, check, cleanup, makeUser, onboard, requireServer } from './harness.mjs';

await requireServer();

const ana = await makeUser('ana');
const bob = await makeUser('bob');
await Promise.all([onboard(ana), onboard(bob)]);

const grupo = await api('/api/conversations', {
  method: 'POST',
  actor: ana,
  body: { type: 'GROUP', name: 'Fondos', memberIds: [bob.id] },
});
const id = grupo.json?.id ?? grupo.json?.conversation?.id;

const puesto = await api(`/api/conversations/${id}/preferences`, {
  method: 'PATCH',
  actor: ana,
  body: { background: 'aurora' },
});
check('se acepta un fondo del catálogo', puesto.status, 200);

const mio = await api(`/api/conversations/${id}`, { actor: ana });
check('y vuelve en el detalle', mio.json?.background, 'aurora');

const suyo = await api(`/api/conversations/${id}`, { actor: bob });
check('sin cambiárselo a nadie más', suyo.json?.background ?? null, null);

const lista = await api('/api/conversations', { actor: ana });
const enLista = (lista.json?.conversations ?? []).find((c) => c.id === id);
check('también en la lista lateral', enLista?.background, 'aurora');

for (const basura of ['url(https://x.test/a.png)', 'aurora; color: red', 'AURORA', '']) {
  const respuesta = await api(`/api/conversations/${id}/preferences`, {
    method: 'PATCH',
    actor: ana,
    body: { background: basura },
  });
  check(`se rechaza «${basura.slice(0, 24)}»`, respuesta.status, 400);
}

const quitado = await api(`/api/conversations/${id}/preferences`, {
  method: 'PATCH',
  actor: ana,
  body: { background: null },
});
check('se puede quitar', quitado.status, 200);
check(
  'y queda sin fondo',
  (await api(`/api/conversations/${id}`, { actor: ana })).json?.background,
  null,
);

await cleanup();
