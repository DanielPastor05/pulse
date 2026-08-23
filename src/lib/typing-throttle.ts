/**
 * ¿Sale un paquete de «está escribiendo» con esta pulsación?
 *
 * Tres líneas en un módulo aparte porque el orden de sus dos condiciones ya se
 * equivocó una vez, y el fallo era invisible.
 *
 * La versión anterior sellaba el reloj del acelerador **antes** de comprobar
 * que el canal existía:
 *
 *     if (ahora - ultimo < ESPERA) return;
 *     ultimo = ahora;                 // ← el turno se gasta aquí
 *     void canal?.send(...);          // ← y aquí puede que no haya canal
 *
 * Suscribirse al canal tarda unos 350 ms medidos contra producción. Quien abre
 * una conversación y escribe dentro de esa ventana perdía el paquete **y**
 * arrancaba la espera de dos segundos, así que al otro lado no aparecía nada
 * hasta dos segundos después de haber empezado a escribir. Nada fallaba: sólo
 * llegaba tarde, que es la clase de fallo que se explica como «va un poco
 * lento» y nunca se busca.
 *
 * Sin dependencias, como `rate-limit-window` y `texto-imposible`, para que
 * `npm test` lo ejecute sin levantar nada.
 */

/** Una pulsación cada dos segundos basta para mantener vivo el indicador. */
export const ESPERA_ESCRITURA_MS = 2_000;

export function debeEnviarEscritura(
  ahora: number,
  ultimoEnvio: number,
  hayCanal: boolean,
): boolean {
  // El canal primero: sin él no hay envío, y por tanto no hay turno que gastar.
  if (!hayCanal) return false;
  return ahora - ultimoEnvio >= ESPERA_ESCRITURA_MS;
}
