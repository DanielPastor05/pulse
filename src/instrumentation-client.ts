import * as Sentry from '@sentry/nextjs';

import { scrubEvent } from '@/lib/sentry-scrub';

/**
 * Browser-side error reporting. Loaded automatically by Next.
 *
 * Notably absent: Session Replay. It records the DOM, which in this app is
 * somebody's private conversation — the exact thing the rest of the codebase
 * works to keep in the room.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    beforeSend: scrubEvent,
    sendDefaultPii: false,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
