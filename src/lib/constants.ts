export const APP_NAME = 'Pulse';
export const APP_TAGLINE = 'Conversations that keep up with you.';

export const MESSAGE_PAGE_SIZE = 40;
export const SEARCH_PAGE_SIZE = 20;
export const NOTIFICATION_PAGE_SIZE = 25;
/** Respuestas de un hilo por pagina. */
export const THREAD_PAGE_SIZE = 50;
/** Entradas del registro de moderacion por pagina. */
export const MODERATION_PAGE_SIZE = 50;

export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_ATTACHMENTS_PER_MESSAGE = 10;
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

export const STORAGE_BUCKETS = {
  attachments: 'attachments',
  avatars: 'avatars',
} as const;

/**
 * Neon pigments. `swatch` is the dark-theme value — the one the picker shows,
 * since dark is where this palette lives. Light mode darkens each one until it
 * clears contrast on paper; see the `[data-accent]` blocks in globals.css.
 */
export const ACCENTS = [
  { id: 'electric', label: 'Electric', swatch: '#00f2ff' },
  { id: 'magenta', label: 'Magenta', swatch: '#ff3ec8' },
  { id: 'lime', label: 'Lime', swatch: '#b6ff3e' },
  { id: 'amber', label: 'Amber', swatch: '#ffc63e' },
  { id: 'violet', label: 'Violet', swatch: '#b48cff' },
  { id: 'crimson', label: 'Crimson', swatch: '#ff5470' },
] as const;

export type AccentId = (typeof ACCENTS)[number]['id'];
export const DEFAULT_ACCENT: AccentId = 'electric';

/**
 * Fondos de conversación. Sólo los identificadores: el dibujo está en
 * `globals.css` bajo `[data-fondo]` y el nombre visible en los diccionarios,
 * así que aquí no hay nada que traducir ni que repintar.
 *
 * Es una lista cerrada y no una URL a propósito. Una imagen cualquiera detrás
 * del texto se lee mal la mitad de las veces, y admitirla abriría otra
 * superficie de subida que vigilar. Con estos siete la conversación se
 * distingue de un vistazo y el texto sigue leyéndose.
 *
 * `ninguno` no tiene regla en el CSS: es la ausencia de fondo, no un fondo
 * blanco. Está en la lista para que se pueda volver atrás.
 */
export const FONDOS = [
  'ninguno',
  'puntos',
  'rejilla',
  'trama',
  'resplandor',
  'aurora',
  'ondas',
] as const;

export type FondoId = (typeof FONDOS)[number];
export const FONDO_POR_DEFECTO: FondoId = 'ninguno';

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '🔥', '👀'] as const;

/**
 * Must stay in sync with `allowed_mime_types` on the storage buckets — that is
 * what actually enforces the rule, since the client sets Content-Type on the
 * upload itself. This copy exists so a bad file fails with a readable message
 * instead of a raw 400 from Storage.
 *
 * No `image/svg+xml`: the buckets are public, and an SVG can carry script.
 */
/**
 * El tipo sin sus parámetros: `audio/webm;codecs=opus` → `audio/webm`.
 *
 * `MediaRecorder` **siempre** devuelve el códec pegado al tipo, y la lista de
 * abajo compara por igualdad exacta. Resultado: toda nota de voz se rechazaba
 * con «That file type is not supported», que es lo que reportó la primera
 * persona que probó a grabar una. `audio/webm` llevaba en la lista desde el
 * principio; lo que no coincidía era la cadena.
 *
 * Se normaliza también en el cliente antes de subir, porque el bucket de
 * Storage compara igual de literal.
 */
export function tipoBase(mimeType: string): string {
  return mimeType.split(';')[0]!.trim().toLowerCase();
}

export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/bmp',
  'image/tiff',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
  'video/ogg',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/aac',
  'audio/mp4',
  'audio/flac',
  'application/pdf',
  'application/zip',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'text/markdown',
];
