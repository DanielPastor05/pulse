import type { ErrorEvent } from '@sentry/nextjs';

/**
 * Strips anything that could carry a private conversation out of an error
 * before it leaves the building.
 *
 * The whole app is built around the idea that only the people in a room can
 * read what is said there. Shipping a stack trace with a message body attached
 * to a third-party service would undo that in one line, and it is the kind of
 * leak nobody notices because the error still looks like an error.
 *
 * So the policy is deny-by-default on anything free-form: message content,
 * search terms, drafts, uploaded file names. What survives is what is needed to
 * find the bug — route, status code, user id.
 */

/** Query and body fields that hold something a person wrote. */
const SENSITIVE_KEYS = new Set([
  'content',
  'body',
  'draft',
  'note',
  'message',
  'q',
  'query',
  'search',
  'term',
  'filename',
  'fileName',
  'name',
  'title',
  'description',
  'bio',
  'statusText',
  'password',
  'token',
  'access_token',
  'refresh_token',
  'apikey',
  'authorization',
]);

const REDACTED = '[redacted]';

function scrubObject(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((entry) => scrubObject(entry, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEYS.has(key) ? REDACTED : scrubObject(entry, depth + 1);
  }
  return out;
}

/**
 * Query strings are dropped whole rather than filtered key by key: a URL is the
 * easiest place for something private to end up, and guessing which parameter
 * is safe is a game that only has to be lost once.
 */
function scrubUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.search) parsed.search = '?[redacted]';
    return parsed.toString();
  } catch {
    return url.split('?')[0] ?? url;
  }
}

/**
 * Deja la primera línea de un mensaje de error y tira el resto.
 *
 * El texto de una excepción es el campo más útil del evento, así que no se
 * redacta entero. Pero algunos errores llevan dentro los datos que provocaron
 * el fallo: `PrismaClientValidationError` imprime el objeto de argumentos
 * completo bajo la primera línea, y en un envío ese objeto contiene el mensaje
 * que la persona estaba escribiendo.
 *
 * La primera línea es el resumen —el tipo de error y qué falló— y es lo que se
 * necesita para reproducirlo. Lo de abajo es el volcado, y ahí es donde se
 * esconde el texto.
 */
function scrubErrorText(value: string): string {
  const [first = ''] = value.split('\n');
  const trimmed = first.trim();
  const shortened = trimmed.length > 300 ? `${trimmed.slice(0, 300)}…` : trimmed;
  return value.includes('\n') ? `${shortened} ${REDACTED}` : shortened;
}

export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  // La excepción misma, que hasta ahora no se miraba.
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((value) => ({
      ...value,
      value: value.value ? scrubErrorText(value.value) : value.value,
    }));
  }
  if (event.message) {
    event.message =
      typeof event.message === 'string' ? scrubErrorText(event.message) : event.message;
  }

  if (event.request) {
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
    delete event.request.cookies;
    delete event.request.headers;
    if (event.request.data) event.request.data = scrubObject(event.request.data);
    if (event.request.query_string) event.request.query_string = REDACTED;
  }

  // The user id is enough to reproduce a bug; the email and handle are not
  // needed and identify a real person to a third party.
  if (event.user) {
    event.user = { id: event.user.id };
  }

  if (event.extra) event.extra = scrubObject(event.extra) as Record<string, unknown>;
  if (event.contexts?.state) delete event.contexts.state;

  // Breadcrumbs replay what happened just before the error, which for a chat
  // app means the text of whatever was being typed or read.
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => ({
      ...crumb,
      message: crumb.category === 'console' ? REDACTED : crumb.message,
      data: crumb.data ? (scrubObject(crumb.data) as Record<string, unknown>) : undefined,
    }));
  }

  return event;
}
