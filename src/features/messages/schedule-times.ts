/** Los atajos de hora del diálogo de programación. */
export const ATAJOS = ['inOneHour', 'thisEvening', 'tomorrowMorning'] as const;

export type Atajo = (typeof ATAJOS)[number];

/** Las horas que significan «esta tarde» y «mañana por la mañana». */
const TARDE = 20;
const MANANA = 9;

/**
 * `datetime-local` da y espera hora de pared local, sin zona: «2026-08-25T15:30».
 *
 * `toISOString()` a secas daría UTC, que en España son una o dos horas menos y
 * pondría el selector a una hora que nadie ha pedido. Restar el desplazamiento
 * antes de formatear es lo que hace que salga la hora que la persona ve en su
 * reloj — y al leerlo de vuelta, `new Date(valor)` lo interpreta como local, así
 * que la conversión a UTC del envío la hace el navegador con la zona correcta.
 */
export function aValorLocal(fecha: Date): string {
  const desplazado = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000);
  return desplazado.toISOString().slice(0, 16);
}

/**
 * Qué hora es cada atajo, contando desde `ahora`.
 *
 * `ahora` entra por parámetro y no se lee dentro: es lo que permite comprobar
 * las nueve de la noche sin esperar a que sean las nueve de la noche.
 */
export function calcularAtajo(clave: Atajo, ahora: Date = new Date()): Date {
  if (clave === 'inOneHour') return new Date(ahora.getTime() + 60 * 60_000);

  const destino = new Date(ahora);

  if (clave === 'thisEvening') {
    destino.setHours(TARDE, 0, 0, 0);
    // Si ya han pasado las ocho, «esta tarde» es la de mañana. Sin esto el
    // atajo propone una hora que ya pasó, el servidor la rechaza por estar en
    // el pasado, y el fallo parece del servidor.
    if (destino <= ahora) destino.setDate(destino.getDate() + 1);
    return destino;
  }

  destino.setDate(destino.getDate() + 1);
  destino.setHours(MANANA, 0, 0, 0);
  return destino;
}
