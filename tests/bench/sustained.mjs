/**
 * Carga sostenida: ¿se degrada con el tiempo, o sólo con el pico?
 *
 *   E2E_APP_URL=https://… node tests/bench/sustained.mjs
 *
 * `bench:load` mide el pico —cuántos aguanta a la vez— y responde una pregunta
 * distinta de ésta. Una fuga de memoria, un bucle de eventos que se atasca o
 * conexiones que no se devuelven al fondo **no aparecen en un pico**: aparecen
 * cuando el proceso lleva un rato vivo. Un servidor que responde igual de bien
 * en el minuto uno que en el cinco no tiene ninguno de los tres.
 *
 * Lo que se mira no es la latencia media, que esconde justo lo que interesa,
 * sino **cómo cambia entre el primer tramo y el último**. Si el p95 del final
 * dobla al del principio con la misma carga, algo se está acumulando.
 *
 * Contra el despliegue no se puede leer la memoria del proceso, así que se
 * infiere por el comportamiento. Es menos directo y es lo que hay: la
 * alternativa sería un entorno local que no se parece al de producción.
 */
import { api, cleanup, makeUser, onboard, requireServer } from '../e2e/harness.mjs';

await requireServer();

const TRAMOS = 6;
const TRAMO_MS = 30_000;
const CONCURRENTES = 4;

const alice = await makeUser('sost');
await onboard(alice);
const grupo = await api('/api/conversations', {
  actor: alice, method: 'POST', body: { type: 'GROUP', name: 'Carga sostenida', memberIds: [] },
});
const grupoId = grupo.json?.id ?? grupo.json?.conversation?.id;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const percentil = (xs, p) => {
  if (xs.length === 0) return 0;
  const orden = [...xs].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.floor((p / 100) * orden.length))];
};

/*
 * Se mide con lecturas y no con envíos.
 *
 * Enviar toparía con el limitador a los pocos segundos y el banco pasaría el
 * resto del tiempo midiendo la latencia de un 429, que es rápida y no toca casi
 * nada. Las lecturas de conversación recorren el camino completo —sesión,
 * pertenencia, consultas— sin gastar cuota de escritura.
 */
async function medir(ms) {
  const latencias = [];
  const codigos = new Map();
  const hasta = Date.now() + ms;

  const trabajador = async () => {
    while (Date.now() < hasta) {
      const t = performance.now();
      const r = await api(`/api/conversations/${grupoId}/messages`, { actor: alice });
      latencias.push(performance.now() - t);
      codigos.set(r.status, (codigos.get(r.status) ?? 0) + 1);
    }
  };

  await Promise.all(Array.from({ length: CONCURRENTES }, trabajador));
  return { latencias, codigos };
}

console.log(`\n${TRAMOS} tramos de ${TRAMO_MS / 1000} s con ${CONCURRENTES} en paralelo`);
console.log(`(${(TRAMOS * TRAMO_MS) / 60_000} minutos de carga continua)\n`);
console.log('tramo    peticiones    p50      p95      p99     no-200');
console.log('-'.repeat(58));

const resumen = [];

for (let i = 0; i < TRAMOS; i += 1) {
  const { latencias, codigos } = await medir(TRAMO_MS);
  const malas = [...codigos.entries()].filter(([c]) => c !== 200).reduce((s, [, n]) => s + n, 0);
  const fila = {
    p50: Math.round(percentil(latencias, 50)),
    p95: Math.round(percentil(latencias, 95)),
    p99: Math.round(percentil(latencias, 99)),
    n: latencias.length,
    malas,
  };
  resumen.push(fila);
  console.log(
    `  ${String(i + 1).padEnd(6)} ${String(fila.n).padStart(10)} ${String(fila.p50).padStart(7)} ` +
    `${String(fila.p95).padStart(8)} ${String(fila.p99).padStart(8)} ${String(malas).padStart(8)}`,
  );
  await dormir(1_000);
}

const primero = resumen[0];
const ultimo = resumen[resumen.length - 1];
const derivaP95 = ultimo.p95 / primero.p95;
const derivaRendimiento = ultimo.n / primero.n;

console.log('\n---');
console.log(`p95 primer tramo → último:  ${primero.p95} ms → ${ultimo.p95} ms  (${derivaP95.toFixed(2)}×)`);
console.log(`peticiones por tramo:        ${primero.n} → ${ultimo.n}  (${derivaRendimiento.toFixed(2)}×)`);

const totalMalas = resumen.reduce((s, f) => s + f.malas, 0);
console.log(`respuestas distintas de 200: ${totalMalas}`);

/*
 * El umbral es 1,5× y no 1,0×: la latencia contra un despliegue real varía
 * sola. Lo que se busca no es ruido, es una tendencia — un p95 que crece tramo
 * a tramo mientras el rendimiento cae es la firma de algo que se acumula.
 */
const problema = derivaP95 > 1.5 || derivaRendimiento < 0.7 || totalMalas > 0;
console.log(
  problema
    ? '\n  SE DEGRADA — mirar memoria, conexiones o bucle de eventos'
    : '\n  estable: el último tramo se comporta como el primero',
);
if (problema) process.exitCode = 1;

await cleanup();
