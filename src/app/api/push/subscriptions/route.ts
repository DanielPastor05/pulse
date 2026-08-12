import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

const subscribeSchema = z.object({
  endpoint: z.string().url().max(512),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
  label: z.string().max(120).nullable().optional(),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(512),
});

/**
 * Registers this browser for push.
 *
 * Upserts on the endpoint: browsers hand back the same one on every visit, so
 * a repeat call refreshes the row instead of collecting duplicates. Reassigning
 * `userId` matters when two people share a device — the subscription follows
 * whoever is signed in now.
 */
export const POST = route(async (request) => {
  const user = await requireUser();
  await rateLimit(`push-subscribe:${user.id}`, rateLimits.mutate);

  const input = await parseBody(request, subscribeSchema);

  await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    update: {
      userId: user.id,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      label: input.label ?? null,
      lastUsedAt: new Date(),
    },
    create: {
      userId: user.id,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      label: input.label ?? null,
    },
  });

  return json({ ok: true }, { status: 201 });
});

/** Scoped to the caller so one account cannot unsubscribe another's devices. */
export const DELETE = route(async (request) => {
  const user = await requireUser();
  await rateLimit(`push-unsubscribe:${user.id}`, rateLimits.mutate);

  const { endpoint } = await parseBody(request, unsubscribeSchema);
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });

  return json({ ok: true });
});
