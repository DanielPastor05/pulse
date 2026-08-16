import 'server-only';

type Level = 'info' | 'warn' | 'error';

/**
 * Structured server logging.
 *
 * One line of JSON per event, because the alternative — `console.error` with a
 * sentence and a stray object — cannot be filtered, counted or alerted on. The
 * failures worth catching here are the quiet ones: a realtime broadcast that
 * gets rejected leaves the REST API working perfectly while every client stops
 * receiving updates, and nobody finds out until somebody complains.
 *
 * Deliberately not a logging library. A dependency buys transports, redaction
 * and child loggers; this needs a JSON line and a level, and going without
 * keeps one more package out of the server bundle.
 *
 * Nothing here should ever receive message content. Sentry has an explicit
 * scrubber for that reason (`lib/sentry-scrub.ts`) and logs deserve the same
 * discipline: identifiers and counts, never what somebody wrote.
 */
function emit(level: Level, event: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({
    level,
    event,
    at: new Date().toISOString(),
    // Vercel sets this per invocation; locally it is simply absent.
    region: process.env.VERCEL_REGION,
    ...fields,
  });

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/** Turns an unknown throwable into something worth reading in a log line. */
export function describeError(error: unknown) {
  if (error instanceof Error) {
    return { error: error.message, errorName: error.name };
  }
  return { error: String(error) };
}

export const log = {
  info: (event: string, fields?: Record<string, unknown>) => emit('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit('warn', event, fields),
  error: (event: string, fields?: Record<string, unknown>) => emit('error', event, fields),
};
