import * as Sentry from '@sentry/nextjs';

import { prisma } from '@/lib/prisma';
import { describeError, log } from '@/server/logger';

/**
 * Percentiles de latencia por endpoint, y un aviso cuando se pasan.
 *
 * El proyecto emitía una línea por petición y nadie la agregaba. Eso no es
 * observabilidad: es tener la señal y no mirarla, que en la práctica se parece
 * bastante a no tenerla — la pregunta «¿va lenta ahora mismo?» seguía sin
 * respuesta sin ponerse a leer registros justo cuando pasaba.
 */

/**
 * Cuánto se guarda. Suficiente para ver la forma de una semana y para que la
 * tabla no crezca sin final.
 */
export const SAMPLE_RETENTION_DAYS = 7;

/** La ventana sobre la que se calcula el percentil que dispara el aviso. */
const WINDOW_MINUTES = 15;

/**
 * Cuántas muestras hacen falta para creerse un p95.
 *
 * Un percentil sobre tres peticiones no es un percentil, es la más lenta de
 * tres. Sin este mínimo, el primer usuario del día con una conexión mala
 * dispara un aviso que no significa nada — y unos cuantos avisos que no
 * significan nada son exactamente cómo se acaba ignorando el panel.
 */
const MIN_SAMPLES = 20;

/** Cada cuánto se molesta alguien en calcular los percentiles. */
const CHECK_EVERY_MINUTES = 5;

/** Y cuánto calla un endpoint que ya avisó, para no repetirlo en bucle. */
const ALERT_COOLDOWN_MINUTES = 30;

/**
 * Lo que se considera aceptable, en milisegundos de p95.
 *
 * Un único umbral para todo sería falso: la búsqueda hace un abanico sobre
 * todas las conversaciones del usuario y siempre va a costar más que leer una
 * fila. Un presupuesto por endpoint es lo que permite que el aviso signifique
 * «esto está peor de lo que debería», y no «esto es la búsqueda».
 */
const P95_BUDGET_MS: Record<string, number> = {
  '/api/search': 1500,
};
const DEFAULT_BUDGET_MS = 1000;

const budgetFor = (route: string) => P95_BUDGET_MS[route] ?? DEFAULT_BUDGET_MS;

/**
 * Rutas que no se miden.
 *
 * `/api/health` lo llama cualquier sonda cada pocos segundos y llenaría la
 * tabla con la latencia de un `select 1`; el cron tarda medio minuto por
 * diseño y arrastraría cualquier percentil global. Ninguno de los dos dice
 * nada sobre si la aplicación va bien para quien la usa.
 */
const IGNORED = ['/api/health', '/api/cron'];

export const isMeasured = (route: string) => !IGNORED.some((prefix) => route.startsWith(prefix));

export type RoutePercentiles = {
  route: string;
  samples: number;
  p50: number;
  p95: number;
  p99: number;
  errors: number;
};

/**
 * Guarda una muestra. Nunca lanza.
 *
 * Se llama desde `after()`, fuera del camino de la respuesta: medir no puede
 * costarle latencia a lo que mide. Y si la escritura falla, la petición ya se
 * respondió — perder una muestra es aceptable, romper la petición por medirla
 * no lo es.
 */
export async function recordSample(sample: {
  route: string;
  method: string;
  status: number;
  ms: number;
}): Promise<void> {
  if (!isMeasured(sample.route)) return;

  try {
    await prisma.$executeRaw`
      INSERT INTO "request_samples" ("route", "method", "status", "ms")
      VALUES (${sample.route}, ${sample.method}, ${sample.status}, ${sample.ms})
    `;
  } catch (error) {
    log.warn('metrics.sample_failed', describeError(error));
  }
}

/** Percentiles por ruta sobre los últimos `minutes` minutos. */
export async function percentiles(minutes: number): Promise<RoutePercentiles[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      route: string;
      samples: bigint;
      p50: number;
      p95: number;
      p99: number;
      errors: bigint;
    }>
  >`
    SELECT "route",
           count(*)                                                    AS samples,
           percentile_cont(0.50) WITHIN GROUP (ORDER BY "ms")          AS p50,
           percentile_cont(0.95) WITHIN GROUP (ORDER BY "ms")          AS p95,
           percentile_cont(0.99) WITHIN GROUP (ORDER BY "ms")          AS p99,
           count(*) FILTER (WHERE "status" >= 500)                     AS errors
      FROM "request_samples"
     WHERE "at" > now() - make_interval(mins => ${minutes}::int)
     GROUP BY "route"
     ORDER BY p95 DESC
  `;

  return rows.map((row) => ({
    route: row.route,
    samples: Number(row.samples),
    p50: Math.round(row.p50),
    p95: Math.round(row.p95),
    p99: Math.round(row.p99),
    errors: Number(row.errors),
  }));
}

/**
 * Se queda con el turno de comprobar, o no hace nada.
 *
 * El `WHERE` del `ON CONFLICT` es lo que lo convierte en un candado: sólo una
 * de las peticiones concurrentes consigue actualizar la fila y recibir un
 * `RETURNING`, y las demás se van sin hacer nada. Es el mismo mecanismo que el
 * limitador de peticiones — un `upsert` que decide, en vez de leer y luego
 * escribir con una carrera en medio.
 */
async function claim(key: string, minutes: number): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ key: string }>>`
    INSERT INTO "metrics_state" ("key", "at") VALUES (${key}, now())
    ON CONFLICT ("key") DO UPDATE SET "at" = now()
     WHERE "metrics_state"."at" < now() - make_interval(mins => ${minutes}::int)
    RETURNING "key"
  `;
  return rows.length > 0;
}

/**
 * Comprueba los percentiles y avisa si alguno se sale del presupuesto.
 *
 * La comprobación va montada sobre el tráfico y no sobre un temporizador. En
 * este plan las tareas programadas corren como mucho una vez al día, y una
 * alerta de latencia que se entera al día siguiente no es una alerta. Que la
 * revise el propio tráfico tiene además una propiedad que un cron no tiene: si
 * no hay peticiones, no hay nada que vigilar.
 *
 * Nunca lanza: corre desprendida de la petición.
 */
export async function checkLatencyBudgets(): Promise<void> {
  try {
    if (!(await claim('check', CHECK_EVERY_MINUTES))) return;

    for (const row of await percentiles(WINDOW_MINUTES)) {
      if (row.samples < MIN_SAMPLES) continue;

      const budget = budgetFor(row.route);
      if (row.p95 <= budget) continue;

      // El aviso por ruta tiene su propia espera: un endpoint que va mal lo va
      // a seguir yendo durante un rato, y repetirlo cada cinco minutos sólo
      // consigue que se deje de leer.
      if (!(await claim(`alert:${row.route}`, ALERT_COOLDOWN_MINUTES))) continue;

      log.warn('metrics.budget_exceeded', { ...row, budget });
      Sentry.captureMessage('latency.budget_exceeded', {
        level: 'warning',
        tags: { subsystem: 'latency', route: row.route },
        extra: { ...row, budget, windowMinutes: WINDOW_MINUTES },
      });
    }
  } catch (error) {
    log.warn('metrics.check_failed', describeError(error));
  }
}

/** Tira lo que ya no cabe en la ventana de retención. */
export async function pruneSamples(): Promise<number> {
  const peticiones = await prisma.$executeRaw`
    DELETE FROM "request_samples"
     WHERE "at" < now() - make_interval(days => ${SAMPLE_RETENTION_DAYS}::int)
  `;
  const vitals = await prisma.$executeRaw`
    DELETE FROM "web_vitals"
     WHERE "at" < now() - make_interval(days => ${SAMPLE_RETENTION_DAYS}::int)
  `;
  return peticiones + vitals;
}

/**
 * Guarda una medida del navegador. Nunca lanza.
 *
 * Es la única señal que no puede venir del servidor: cuánto tarda el servidor
 * en responder se mide dentro, pero cuánto tarda una pantalla en pintarse sólo
 * lo sabe quien la está mirando.
 */
export async function recordVital(vital: {
  metric: string;
  value: number;
  rating: string;
  path: string;
}): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO "web_vitals" ("metric", "value", "rating", "path")
      VALUES (${vital.metric}, ${vital.value}, ${vital.rating}, ${vital.path})
    `;
  } catch (error) {
    log.warn('metrics.vital_failed', describeError(error));
  }
}

export type VitalSummary = {
  metric: string;
  samples: number;
  p50: number;
  p75: number;
  good: number;
};

/**
 * Percentiles de las métricas del navegador.
 *
 * p75 y no p95 porque es el que define Google para los Core Web Vitals: la
 * pregunta no es «cuál fue la peor carga» sino «¿le va bien a tres de cada
 * cuatro personas?». Usar otro percentil daría un número que no se puede
 * comparar con ningún umbral publicado.
 */
export async function vitals(minutes: number): Promise<VitalSummary[]> {
  const rows = await prisma.$queryRaw<
    Array<{ metric: string; samples: bigint; p50: number; p75: number; good: bigint }>
  >`
    SELECT "metric",
           count(*)                                              AS samples,
           percentile_cont(0.50) WITHIN GROUP (ORDER BY "value")  AS p50,
           percentile_cont(0.75) WITHIN GROUP (ORDER BY "value")  AS p75,
           count(*) FILTER (WHERE "rating" = 'good')              AS good
      FROM "web_vitals"
     WHERE "at" > now() - make_interval(mins => ${minutes}::int)
     GROUP BY "metric"
     ORDER BY "metric"
  `;

  return rows.map((row) => ({
    metric: row.metric,
    samples: Number(row.samples),
    // CLS es una puntuación sin unidad y muy pequeña, así que redondear a
    // entero la borraría. Tres decimales es lo que usan los umbrales.
    p50: Number(row.p50.toFixed(3)),
    p75: Number(row.p75.toFixed(3)),
    good: Number(row.good),
  }));
}
