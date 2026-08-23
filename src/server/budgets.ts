/**
 * Cuándo un endpoint merece un aviso.
 *
 * Estaba dentro de `metrics.ts` mezclado con el SQL y el candado, y ahí no se
 * podía probar: para comprobar una comparación había que levantar Postgres. La
 * regla es justo lo que conviene tener probado — es la que decide si alguien se
 * entera de que algo va mal.
 *
 * Sin dependencias a propósito, como `rate-limit-window`, para que `npm test` la
 * ejecute sin levantar nada.
 */

export type MuestraDeRuta = {
  route: string;
  samples: number;
  p95: number;
  errors: number;
};

/**
 * Cuántas muestras hacen falta para creerse un p95.
 *
 * Un percentil sobre tres peticiones no es un percentil, es la más lenta de
 * tres. Sin este mínimo, el primer usuario del día con una conexión mala
 * dispara un aviso que no significa nada — y unos cuantos avisos que no
 * significan nada son exactamente cómo se acaba ignorando el panel.
 */
export const MIN_MUESTRAS = 20;

/**
 * La parte de peticiones que pueden fallar antes de que sea un problema.
 *
 * Un 1% sobre una ventana de quince minutos. No es «cero errores»: eso no es un
 * presupuesto, es una aspiración, y convierte cualquier fallo aislado de red en
 * una alarma.
 */
export const PRESUPUESTO_DE_ERROR = 0.01;

/**
 * Y el mínimo absoluto para que un porcentaje signifique algo.
 *
 * Tres 500 en quince minutos no son una casualidad; uno sí puede serlo. Este
 * umbral es lo que permite avisar de un endpoint **poco transitado que está roto
 * del todo** — cinco peticiones y cinco errores nunca llegarían a `MIN_MUESTRAS`,
 * así que la regla del porcentaje sola lo dejaría en silencio para siempre.
 *
 * Que un 500 suelto no avise aquí no significa que se pierda: cada excepción no
 * controlada ya se reporta a Sentry una a una desde `toErrorResponse`. Esto
 * responde a otra pregunta — no «¿ha fallado algo?» sino «¿está fallando esta
 * ruta a un ritmo que importa?».
 */
export const MIN_ERRORES = 3;

export function superaLatencia(fila: MuestraDeRuta, presupuestoMs: number): boolean {
  if (fila.samples < MIN_MUESTRAS) return false;
  return fila.p95 > presupuestoMs;
}

export function superaErrores(fila: MuestraDeRuta): boolean {
  if (fila.errors === 0) return false;

  // Dos caminos, y hacen falta los dos: el absoluto caza la ruta rota con poco
  // tráfico, el relativo caza el goteo en la ruta con mucho.
  if (fila.errors >= MIN_ERRORES) return true;
  return fila.samples >= MIN_MUESTRAS && fila.errors / fila.samples > PRESUPUESTO_DE_ERROR;
}

/** La proporción de error, redondeada a algo que se pueda leer en un aviso. */
export function tasaDeError(fila: MuestraDeRuta): number {
  if (fila.samples === 0) return 0;
  return Number((fila.errors / fila.samples).toFixed(4));
}
