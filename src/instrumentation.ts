import * as Sentry from '@sentry/nextjs';

import { scrubEvent } from '@/lib/sentry-scrub';

/**
 * Server-side error reporting.
 *
 * Server only, deliberately. Wiring the browser SDK too was measured at
 * +96 kB of first-load JavaScript on every visit — @sentry/core alone is
 * ~106 kB parsed — which is a poor trade for a chat app: the errors you cannot
 * otherwise see are the ones on the server, while a client exception still
 * shows up in the console and is caught by the `error.tsx` boundaries.
 *
 * Off unless `NEXT_PUBLIC_SENTRY_DSN` is set, the same way push is off without
 * VAPID keys: a clone of this repo has to run without anyone's account.
 */
export function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // A chat app is chatty; 10% is plenty to spot a slow route without paying
    // to record every keystroke's worth of traffic.
    tracesSampleRate: 0.1,
    // Everything free-form is stripped before an event leaves. See the module
    // for why this is deny-by-default rather than a list of things to hide.
    beforeSend: scrubEvent,
    // Off by default anyway; set explicitly so nobody turns it on by accident
    // and starts shipping request bodies.
    sendDefaultPii: false,
  });
}

/**
 * Next calls this for errors thrown inside server components and route
 * handlers, which otherwise never reach the global handler.
 */
export const onRequestError = Sentry.captureRequestError;
