/**
 * Los tres tiempos del indicador de «está escribiendo», y por qué van juntos.
 *
 * No son tres constantes independientes: **el aviso parpadea si la vida no
 * supera al acelerador**, porque entre paquete y paquete no llega nada que
 * refresque la entrada. Y la cola —lo que el aviso tarda en irse cuando alguien
 * deja de escribir— es la suma de los tres. Tocar uno solo rompe una de las dos
 * propiedades, así que viven en el mismo sitio con las pruebas que las fijan.
 *
 * Sin dependencias, como `rate-limit-window` y `texto-imposible`, para que
 * `npm test` los ejecute sin levantar nada.
 */

/**
 * Cada cuánto sale un paquete mientras alguien escribe.
 *
 * Era de 2 s, que sale barato en tráfico y caro en sensación: el último paquete
 * podía ser dos segundos anterior al momento en que la persona para, y esos dos
 * segundos se suman enteros a la cola.
 */
export const ESPERA_ESCRITURA_MS = 1_000;

/**
 * Cuánto sobrevive una entrada sin que llegue otro paquete.
 *
 * Era de 4 s. Tiene que superar al acelerador con margen para el viaje —medido
 * en 47 ms de mediana y 168 el peor caso— y nada más: lo que sobre es cola.
 */
export const VIDA_ESCRITURA_MS = 2_500;

/**
 * Cada cuánto se miran las entradas para tirar las caducadas.
 *
 * Era de 1 s, y ese segundo se sumaba a la cola sin dar nada a cambio: la
 * comprobación es un filtro sobre un objeto con dos o tres claves.
 */
export const BARRIDO_ESCRITURA_MS = 250;

export function debeEnviarEscritura(
  ahora: number,
  ultimoEnvio: number,
  hayCanal: boolean,
): boolean {
  // El canal primero: sin él no hay envío, y por tanto no hay turno que gastar.
  //
  // El orden de estas dos condiciones **es** el arreglo. Antes se sellaba el
  // reloj y luego se intentaba enviar por un canal que podía no existir todavía;
  // suscribirse tarda unos 350 ms medidos contra producción, así que quien
  // escribía dentro de esa ventana perdía el paquete y encima arrancaba la
  // espera. Nada fallaba: sólo llegaba tarde.
  if (!hayCanal) return false;
  return ahora - ultimoEnvio >= ESPERA_ESCRITURA_MS;
}

/** ¿Se tira ya esta entrada? */
export function haCaducado(ahora: number, recibidoEn: number): boolean {
  return ahora - recibidoEn >= VIDA_ESCRITURA_MS;
}

/**
 * ¿Vale la pena mandar la pulsación que se quedó sin canal, ahora que lo hay?
 *
 * Cubre el caso corriente de abrir una conversación, escribir una palabra y
 * parar: sin esto no sale ningún paquete —el único intento cayó en la ventana de
 * suscripción— y al otro lado no aparece nada en absoluto.
 *
 * Con caducidad, porque reenviar sin más mostraría «está escribiendo» por
 * alguien que dejó de hacerlo hace rato. Se usa la misma espera del acelerador:
 * si la pulsación es más vieja que eso, ya no describe el presente.
 */
export function mereceLaPenaReenviar(ahora: number, pendienteDesde: number): boolean {
  return ahora - pendienteDesde < ESPERA_ESCRITURA_MS;
}
