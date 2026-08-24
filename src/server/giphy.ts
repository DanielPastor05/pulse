/**
 * La forma de una respuesta de GIPHY, traducida a lo que el selector necesita.
 *
 * En módulo aparte y sin dependencias para poder probar la traducción sin clave:
 * se le da una respuesta con la forma documentada y se mira qué sale.
 *
 * **La forma está verificada contra la API real** (24/08/2026, `search` de los
 * dos catálogos con `rating=g` y `lang=es`): `fixed_width_small` y
 * `downsized_medium` vienen en los resultados, `alt_text` también, y se mapearon
 * cinco de cinco en cada catálogo. Hasta ese día esto era una suposición leída
 * de la documentación y así estaba escrito aquí, porque unas pruebas en verde
 * sobre una forma inventada no valen nada.
 */

export type GifKind = 'gif' | 'sticker';

export type GifResult = {
  id: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
  description: string;
};

type Rendition = { url?: string; width?: string; height?: string };

export type GiphyResponse = {
  data?: Array<{
    id?: string;
    title?: string;
    alt_text?: string;
    images?: Record<string, Rendition>;
  }>;
};

/**
 * Qué formato se coge, por orden de preferencia.
 *
 * Para la rejilla se busca lo más liviano que siga animado: `fixed_width_small`
 * son 100 px de ancho, que es justo el tamaño de una celda. Para lo que se
 * manda, `downsized_medium` acota el peso a 5 MB — mandar el original de 480 px
 * a una conversación de móvil es descortés.
 *
 * Las listas son largas a propósito. GIPHY no garantiza todas las variantes en
 * todos los resultados, y una rejilla con huecos es peor que una celda un poco
 * más pesada de lo ideal.
 */
const VISTA_PREVIA = [
  'fixed_width_small',
  'fixed_width_downsampled',
  'fixed_width',
  'downsized',
  'original',
] as const;

const COMPLETO = ['downsized_medium', 'downsized', 'original', 'fixed_width'] as const;

function primero(
  imagenes: Record<string, Rendition> | undefined,
  preferencia: readonly string[],
): Rendition | undefined {
  for (const nombre of preferencia) {
    const formato = imagenes?.[nombre];
    if (formato?.url) return formato;
  }
  return undefined;
}

/** Las medidas llegan como cadenas; un `NaN` en un `width` rompe la rejilla. */
function aNumero(valor: string | undefined, porDefecto: number): number {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : porDefecto;
}

/**
 * Traduce la respuesta, descartando lo que no se pueda pintar.
 *
 * Un resultado sin URL utilizable se cae en vez de colarse con la cadena vacía:
 * un `<img src="">` pide la página actual otra vez, que es la peor forma
 * posible de fallar.
 */
export function mapearGiphy(payload: GiphyResponse, kind: GifKind): GifResult[] {
  return (payload.data ?? []).flatMap((item) => {
    const completo = primero(item.images, COMPLETO);
    const preview = primero(item.images, VISTA_PREVIA) ?? completo;
    if (!completo?.url || !preview?.url || !item.id) return [];

    return [
      {
        id: item.id,
        url: completo.url,
        previewUrl: preview.url,
        width: aNumero(completo.width, 320),
        height: aNumero(completo.height, 240),
        // `alt_text` es lo que GIPHY escribe para lectores de pantalla y `title`
        // lo que enseña; el primero describe mejor y a menudo falta.
        description: item.alt_text || item.title || (kind === 'sticker' ? 'Sticker' : 'GIF'),
      },
    ];
  });
}
