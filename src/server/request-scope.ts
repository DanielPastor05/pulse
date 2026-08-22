import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Memoización con alcance de una petición, para route handlers.
 *
 * Existe porque `cache()` de React **no sirve aquí**, y eso se midió en vez de
 * suponerlo: una ruta de sonda que llamaba dos veces a la misma función
 * memoizada con `cache()` ejecutó la consulta **dos veces** en cada petición.
 * `cache()` necesita el alcance que React monta al renderizar; un route handler
 * no renderiza nada, así que la memoización se convierte en decoración.
 *
 * Lo que no era decoración es lo que costaba: varias rutas ya comprobaban la
 * pertenencia y llamaban después a un servicio que la vuelve a comprobar, o sea
 * que llevaban tiempo pagando dos consultas idénticas por petición sin que se
 * notara.
 *
 * `AsyncLocalStorage` sí funciona en el runtime de Node, que es donde corren
 * los route handlers. Fuera de un alcance —una prueba unitaria, un script— no
 * memoiza y simplemente ejecuta: nunca devuelve un valor de otra petición.
 *
 * Sin `server-only` a propósito, por el mismo motivo que `rate-limit-window`:
 * el marcador lo haría imposible de importar desde el ejecutor de pruebas, y
 * `node:async_hooks` ya rompe cualquier intento de meterlo en el cliente.
 */
const almacen = new AsyncLocalStorage<Map<string, Promise<unknown>>>();

/** Abre el alcance. Lo llama `route()`, una vez por petición. */
export function conAlcanceDePeticion<T>(trabajo: () => Promise<T>): Promise<T> {
  return almacen.run(new Map(), trabajo);
}

/**
 * Devuelve el resultado guardado para `clave`, o ejecuta `hacer` y lo guarda.
 *
 * Guarda la **promesa**, no el valor: dos llamadas concurrentes con la misma
 * clave comparten una sola ejecución en vez de lanzar dos consultas iguales.
 * Los rechazos se guardan igual, que es lo correcto aquí — si no eres miembro,
 * no vas a serlo dos líneas más abajo.
 */
export function memoDePeticion<T>(clave: string, hacer: () => Promise<T>): Promise<T> {
  const mapa = almacen.getStore();
  if (!mapa) return hacer();

  const guardado = mapa.get(clave) as Promise<T> | undefined;
  if (guardado) return guardado;

  const prometido = hacer();
  mapa.set(clave, prometido);
  return prometido;
}
