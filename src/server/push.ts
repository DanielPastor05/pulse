import webpush from 'web-push';

import { prisma } from '@/lib/prisma';
import { publicEnv, serverEnv } from '@/lib/env';
import { describeError, log } from '@/server/logger';

/**
 * Web Push delivery.
 *
 * The browser Notification API only works while the page is alive, which for a
 * chat app is the wrong half of the problem: you learn about a message exactly
 * when you did not need telling. This reaches a device whose tab is closed.
 *
 * Failures never propagate. A push that does not arrive must not break the
 * request that triggered it — the in-app notification and the realtime event
 * have already gone out by then.
 */

export type PushPayload = {
  title: string;
  body: string | null;
  /** Where clicking the notification should land. */
  url: string;
  tag: string;
};

let configured = false;

/** Returns false when the keys are absent, which is a valid way to run. */
function ensureConfigured(): boolean {
  if (configured) return true;

  const publicKey = publicEnv.vapidPublicKey;
  const privateKey = serverEnv.vapidPrivateKey;
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(serverEnv.vapidSubject, publicKey, privateKey);
  configured = true;
  return true;
}

export function pushIsConfigured(): boolean {
  return ensureConfigured();
}

/**
 * Sends to every device the given users have registered.
 *
 * Subscriptions the push service rejects as gone (404/410) are deleted: an
 * endpoint dies when the browser is uninstalled or clears its data, and
 * without pruning the table fills with devices that will never answer again.
 */
export async function pushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0 || !ensureConfigured()) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);
  const dead: string[] = [];

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body,
          { TTL: 60 * 60 * 24 },
        );
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          dead.push(subscription.id);
          return;
        }
        log.error('push.delivery_failed', { status, ...describeError(error) });
      }
    }),
  );

  if (dead.length > 0) {
    await prisma.pushSubscription
      .deleteMany({ where: { id: { in: dead } } })
      .catch((error) => log.error('push.prune_failed', describeError(error)));
  }
}
