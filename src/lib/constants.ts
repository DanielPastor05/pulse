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

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '🔥', '👀'] as const;

/**
 * Must stay in sync with `allowed_mime_types` on the storage buckets — that is
 * what actually enforces the rule, since the client sets Content-Type on the
 * upload itself. This copy exists so a bad file fails with a readable message
 * instead of a raw 400 from Storage.
 *
 * No `image/svg+xml`: the buckets are public, and an SVG can carry script.
 */
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
