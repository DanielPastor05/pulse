/**
 * ¿Cuánto se cuela de verdad por el limitador?
 *
 *   E2E_APP_URL=https://… node tests/bench/rate-limit.mjs
 *
 * El límite dice «25 mensajes cada 10 segundos». Con una ventana fija eso no es
 * lo que ocurre: quien gasta su cuota al final de una ventana y vuelve a
 * gastarla al principio de la siguiente mete el doble en diez segundos
 * cualesquiera. Está documentado como techo conocido, pero documentado no es
 * medido.
 *
 * **Cómo se mide, que es la parte que cuesta.** El primer intento trataba de
 * acertar el borde de la ventana durmiendo la diferencia — y falló, porque cada
 * ráfaga contra el despliegue tarda segundos y la aritmética se desfasa. El
 * número que salía dependía de mi cronómetro, no del limitador.
 *
 * Así que no se busca el borde. Se manda un goteo constante, se apunta la hora
 * de cada aceptación, y al final se calcula el **máximo aceptado en cualquier
 * ventana deslizante de diez segundos**. Esa es la definición de la que habla
 * el límite, y no depende de dónde caiga el corte.
 */
import { api, cleanup, makeUser, onboard, requireServer } from '../e2e/harness.mjs';

await requireServer();

const LIMITE = 25;
const VENTANA_MS = 10_000;
const DURACION_MS = 40_000;

/*
 * Ráfagas, no goteo.
 *
 * Un goteo constante a cinco por segundo daba 1,08× — un número honesto que
 * **no es el peor caso**. El fallo de la ventana fija no aparece repartiendo la
 * carga: aparece gastando la cuota entera de golpe al final de una ventana y
 * otra vez al principio de la siguiente. Midiendo con goteo se concluiría que
 * el limitador va fino, y lo que iría fino es la prueba.
 *
 * Con ráfagas cada 1,5 s sobre ventanas de 10 s, alguna pareja cae a los dos
 * lados de un corte por construcción.
 */
const RAFAGA = LIMITE;
const ENTRE_RAFAGAS_MS = 1_500;

const alice = await makeUser('rl');
await onboard(alice);
const grupo = await api('/api/conversations', {
  actor: alice, method: 'POST', body: { type: 'GROUP', name: 'Sala del limitador', memberIds: [] },
});
const grupoId = grupo.json?.id ?? grupo.json?.conversation?.id;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`\nlímite declarado: ${LIMITE} cada ${VENTANA_MS / 1000} s`);
console.log(`ráfagas de ${RAFAGA} cada ${ENTRE_RAFAGAS_MS} ms durante ${DURACION_MS / 1000} s\n`);

const aceptados = [];
let limitados = 0;
let errores = 0;
let n = 0;

const inicio = Date.now();
const enVuelo = [];

while (Date.now() - inicio < DURACION_MS) {
  for (let k = 0; k < RAFAGA; k += 1) {
    const i = n++;
    enVuelo.push(
      api(`/api/conversations/${grupoId}/messages`, {
        actor: alice, method: 'POST', body: { content: `carga ${i}`, clientId: `rl-${i}` },
      }).then((r) => {
        // Se apunta cuándo **llegó la respuesta**, que es lo que el servidor contó.
        if (r.status === 201) aceptados.push(Date.now());
        else if (r.status === 429) limitados += 1;
        else if (r.status >= 500) errores += 1;
      }),
    );
  }
  await dormir(ENTRE_RAFAGAS_MS);
}
await Promise.all(enVuelo);

aceptados.sort((a, b) => a - b);

/** El máximo de aceptaciones que caben en una ventana deslizante. */
function picoDeslizante(marcas, ventanaMs) {
  let pico = 0;
  let desde = 0;
  for (let hasta = 0; hasta < marcas.length; hasta += 1) {
    while (marcas[hasta] - marcas[desde] >= ventanaMs) desde += 1;
    pico = Math.max(pico, hasta - desde + 1);
  }
  return pico;
}

const pico = picoDeslizante(aceptados, VENTANA_MS);
const ratio = pico / LIMITE;

console.log(`enviados      ${n}`);
console.log(`aceptados     ${aceptados.length}`);
console.log(`limitados     ${limitados}`);
console.log(`errores 5xx   ${errores}`);
console.log(`\npico en 10 s deslizantes: ${pico}   (${ratio.toFixed(2)}× el límite)`);

console.log(
  ratio > 1.5
    ? '\n  VENTANA FIJA — el pico real casi dobla lo declarado'
    : '\n  el pico se mantiene en el límite declarado',
);

if (errores) {
  console.log(`\n  OJO: ${errores} respuestas 5xx bajo carga`);
  process.exitCode = 1;
}

await cleanup();
