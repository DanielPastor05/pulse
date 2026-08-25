/**
 * Mensajes programados, contra la instancia desplegada.
 *
 *   E2E_APP_URL=https://… node tests/e2e/scheduled.mjs
 *
 * Lo que hay que demostrar aquí no es que la fila se guarde —eso lo diría
 * cualquier `INSERT`— sino las tres cosas que de verdad pueden estar mal:
 *
 *   1. Que el mensaje **no se vea antes de tiempo**. Es la razón entera de que
 *      esto viva en su propia tabla y no como un mensaje con fecha futura.
 *   2. Que **salga solo**, sin que nadie lo empuje, en cuanto hay tráfico.
 *   3. Que no lo pueda leer ni cancelar quien no lo escribió.
 *
 * La entrega va colgada del tráfico, así que este guion tiene que *generar*
 * tráfico mientras espera. Eso no es hacer trampa: es exactamente lo que ocurre
 * en producción, donde el tráfico lo genera la gente. Si el mensaje sólo saliera
 * porque una prueba lo pide, no habría entrega automática que enseñar.
 */
import { api, check, cleanup, makeUser, onboard, requireServer } from './harness.mjs';

await requireServer();

/** El adelanto con el que se programa. Corto para no alargar la prueba. */
const ADELANTO_MS = 8_000;

/**
 * Cuánto se espera como mucho a que salga.
 *
 * Generoso a propósito: cada instancia mira la base cada veinte segundos, y en
 * un despliegue con varias instancias la petición que dispara el despacho puede
 * caer en una que acaba de mirar. Sesenta segundos cubre ese caso sin que la
 * prueba se vuelva un sorteo.
 */
const ESPERA_MAX_MS = 60_000;
const SONDEO_MS = 2_000;

const espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

console.log('\npreparando identidades…');
const alice = await makeUser('alice');
const bob = await makeUser('bob');
const mallory = await makeUser('mallory');
await Promise.all([onboard(alice), onboard(bob), onboard(mallory)]);

const grupo = await api('/api/conversations', {
  method: 'POST',
  actor: alice,
  body: { name: 'Programados', isPublic: false, accent: 'violet', memberIds: [bob.id] },
});
if (grupo.status !== 201) {
  throw new Error(`no se pudo crear el grupo -> ${grupo.status} ${JSON.stringify(grupo.json)}`);
}
const id = grupo.json.conversation.id;

// ---------------------------------------------------------------------------
console.log('\nprogramar');

const marca = `programado-${Date.now()}`;
const cuando = new Date(Date.now() + ADELANTO_MS).toISOString();

const creado = await api(`/api/conversations/${id}/scheduled`, {
  method: 'POST',
  actor: alice,
  body: { content: marca, scheduledFor: cuando },
});
check('se acepta un mensaje para dentro de ocho segundos', creado.status, 201);
const programadoId = creado.json?.scheduled?.id;

const enPasado = await api(`/api/conversations/${id}/scheduled`, {
  method: 'POST',
  actor: alice,
  body: { content: 'tarde', scheduledFor: new Date(Date.now() - 60_000).toISOString() },
});
check('una hora pasada se rechaza', enPasado.status, 400);

const muyLejos = await api(`/api/conversations/${id}/scheduled`, {
  method: 'POST',
  actor: alice,
  body: { content: 'lejos', scheduledFor: new Date(Date.now() + 400 * 86_400_000).toISOString() },
});
check('más de un año se rechaza', muyLejos.status, 400);

// ---------------------------------------------------------------------------
console.log('\nantes de la hora');

const lista = await api(`/api/conversations/${id}/scheduled`, { actor: alice });
check('quien lo escribió lo ve en su lista', lista.json?.scheduled?.length, 1);

const hilo = await api(`/api/conversations/${id}/messages`, { actor: bob });
const asomado = JSON.stringify(hilo.json).includes(marca);
check('NO está en el hilo todavía', asomado, false);

const resumen = await api('/api/conversations', { actor: bob });
const enVistaPrevia = JSON.stringify(resumen.json).includes(marca);
check('NO está en la vista previa de la lista', enVistaPrevia, false);

const busqueda = await api(`/api/search?q=${encodeURIComponent(marca)}&scope=messages`, {
  actor: bob,
});
const buscable = JSON.stringify(busqueda.json).includes(marca);
check('NO aparece al buscarlo', buscable, false);

// ---------------------------------------------------------------------------
console.log('\nquien no lo escribió');

const deBob = await api(`/api/conversations/${id}/scheduled`, { actor: bob });
check('un compañero de grupo ve su lista, no la mía', deBob.json?.scheduled?.length, 0);

const deMallory = await api(`/api/conversations/${id}/scheduled`, { actor: mallory });
check('quien no es miembro no ve nada', [403, 404].includes(deMallory.status), true);

const cancelaBob = await api(`/api/conversations/${id}/scheduled/${programadoId}`, {
  method: 'DELETE',
  actor: bob,
});
check('un compañero no puede cancelar el mío', cancelaBob.status, 404);

// ---------------------------------------------------------------------------
console.log(`\nesperando a que salga solo (hasta ${ESPERA_MAX_MS / 1000} s)…`);

await espera(ADELANTO_MS);

const partida = Date.now();
let salio = false;
let tardanza = null;

while (Date.now() - partida < ESPERA_MAX_MS) {
  // Cada vuelta es una petición, o sea tráfico: es el propio uso de la
  // aplicación lo que dispara el despacho.
  const actual = await api(`/api/conversations/${id}/messages`, { actor: bob });
  if (JSON.stringify(actual.json).includes(marca)) {
    salio = true;
    tardanza = Date.now() - partida;
    break;
  }
  await espera(SONDEO_MS);
}

check('el mensaje sale solo, sin que nadie lo envíe', salio, true);
if (salio) console.log(`        tardó ${(tardanza / 1000).toFixed(1)} s desde la hora`);

const restante = await api(`/api/conversations/${id}/scheduled`, { actor: alice });
check('y deja de estar en la lista de pendientes', restante.json?.scheduled?.length, 0);

// ---------------------------------------------------------------------------
console.log('\nno se duplica');

// El despacho vuelve a correr en cada petición. Si el reclamo o la idempotencia
// fallaran, unas cuantas peticiones más publicarían el mismo mensaje otra vez.
for (let i = 0; i < 5; i += 1) await api('/api/conversations', { actor: alice });

const despues = await api(`/api/conversations/${id}/messages`, { actor: bob });
const veces = (despues.json?.items ?? []).filter((m) => m.content === marca).length;
check('sigue habiendo exactamente uno', veces, 1);

// ---------------------------------------------------------------------------
console.log('\ncancelar');

const otro = await api(`/api/conversations/${id}/scheduled`, {
  method: 'POST',
  actor: alice,
  body: { content: 'este no sale', scheduledFor: new Date(Date.now() + 3_600_000).toISOString() },
});
const otroId = otro.json?.scheduled?.id;

const cancelado = await api(`/api/conversations/${id}/scheduled/${otroId}`, {
  method: 'DELETE',
  actor: alice,
});
check('se cancela el propio', cancelado.status, 200);

const yaNo = await api(`/api/conversations/${id}/scheduled`, { actor: alice });
check('y desaparece de la lista', yaNo.json?.scheduled?.length, 0);

const dosVeces = await api(`/api/conversations/${id}/scheduled/${otroId}`, {
  method: 'DELETE',
  actor: alice,
});
check('cancelarlo dos veces no finge que existía', dosVeces.status, 404);

await cleanup();
console.log('');
