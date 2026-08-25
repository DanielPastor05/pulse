/**
 * Cómo se resume un mensaje cuando se enseña fuera de su sitio.
 *
 * Un GIF o un sticker se guardan como markdown —`![alto](url "sticker")`— porque
 * así el mensaje sigue siendo texto corriente en la base y en la exportación.
 * Eso está bien mientras se pinte con el renderizador; el problema aparece en
 * los cuatro sitios que enseñan un mensaje **en pequeño y sin renderizar**: la
 * cita al responder, el avance de la barra lateral, el panel de fijados y el
 * diálogo de reenvío.
 *
 * En todos ellos salía la URL entera en crudo. Reportado así: «los gifs al
 * responder respondes al enlace entero, por lo que no sale».
 *
 * Aquí sólo se **reconoce** la forma; qué pintar con ella lo decide cada sitio
 * — una miniatura donde hay hueco, una etiqueta donde no.
 */

export type VistaPrevia =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'imagen'; url: string; alt: string; sticker: boolean };

/**
 * Un mensaje que es **sólo** una imagen de markdown, y nada más.
 *
 * El anclaje a principio y fin es lo que lo hace seguro: un mensaje que dice
 * «mira esto ![x](u) y esto otro» es texto con una imagen dentro, y resumirlo
 * como «una imagen» perdería lo que la persona escribió.
 */
const SOLO_IMAGEN = /^!\[([^\]]*)\]\(\s*(\S+?)(?:\s+"([^"]*)")?\s*\)$/;

export function vistaPreviaDe(contenido: string): VistaPrevia {
  const texto = contenido.trim();
  const encontrado = SOLO_IMAGEN.exec(texto);

  if (!encontrado) return { tipo: 'texto', texto: contenido };

  return {
    tipo: 'imagen',
    url: encontrado[2]!,
    alt: (encontrado[1] ?? '').trim(),
    sticker: encontrado[3] === 'sticker',
  };
}
