import { randomUUID } from 'node:crypto';

import type { NotificationKind } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { realtimeEvents } from '@/lib/realtime';
import { broadcastPerUser } from '@/server/broadcast';
import { pushToUsers } from '@/server/push';
import { notificationInclude, toNotification } from '@/server/repositories/selectors';

/**
 * Which profile toggle gates each kind.
 *
 * Only the three chatty kinds have a switch in Settings. The social ones
 * (friend requests, group invites, join requests) have no toggle and always
 * deliver — silently dropping those would lose something the user cannot get
 * back by scrolling.
 */
const PREFERENCE_BY_KIND = {
  MESSAGE: 'notifyOnMessage',
  MENTION: 'notifyOnMention',
  REACTION: 'notifyOnReaction',
} as const satisfies Partial<Record<NotificationKind, string>>;

export type NotificationInput = {
  userIds: string[];
  kind: NotificationKind;
  title: string;
  body?: string | null;
  actorId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
};

/**
 * Persists one notification per recipient and pushes it down that recipient's
 * private realtime channel. Muting and the per-user notification toggles are
 * both applied here so no call site has to remember to do it.
 *
 * Writes go out as one `createMany` and one broadcast rather than a loop: a
 * mention in a 50-person group was 50 inserts and 50 HTTP requests.
 */
export async function notify(input: NotificationInput): Promise<void> {
  const recipients = input.actorId
    ? input.userIds.filter((id) => id !== input.actorId)
    : input.userIds;
  if (recipients.length === 0) return;

  let allowed = [...new Set(recipients)];

  if (input.conversationId) {
    const members = await prisma.conversationMember.findMany({
      where: { conversationId: input.conversationId, userId: { in: allowed }, muted: false },
      select: { userId: true },
    });
    allowed = members.map((member) => member.userId);
  }
  if (allowed.length === 0) return;

  const preference = PREFERENCE_BY_KIND[input.kind as keyof typeof PREFERENCE_BY_KIND];
  if (preference) {
    const opted = await prisma.user.findMany({
      where: { id: { in: allowed }, [preference]: true },
      select: { id: true },
    });
    allowed = opted.map((user) => user.id);
    if (allowed.length === 0) return;
  }

  // Ids are generated here so the rows can be read back after `createMany`,
  // which does not return them.
  const rows = allowed.map((userId) => ({
    id: randomUUID(),
    userId,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    actorId: input.actorId ?? null,
    conversationId: input.conversationId ?? null,
    messageId: input.messageId ?? null,
  }));

  await prisma.notification.createMany({ data: rows });

  const created = await prisma.notification.findMany({
    where: { id: { in: rows.map((row) => row.id) } },
    include: notificationInclude,
  });

  await broadcastPerUser(
    created.map((notification) => ({
      userId: notification.userId,
      payload: { notification: toNotification(notification) },
    })),
    realtimeEvents.notification,
  );

  // Everything above only lands if the app is open. This is the part that
  // reaches a closed tab, and it reuses the recipient list already worked out
  // here rather than deciding all over again who should hear about this.
  const wantPush = await prisma.user.findMany({
    where: { id: { in: allowed }, notifyDesktopPush: true },
    select: { id: true },
  });

  if (wantPush.length > 0) {
    await pushToUsers(
      wantPush.map((user) => user.id),
      {
        title: input.title,
        body: input.body ?? null,
        url: input.conversationId ? `/chat/${input.conversationId}` : '/chat',
        // Collapses repeats from the same conversation into one entry rather
        // than stacking a row per message.
        tag: input.conversationId ?? input.kind,
      },
    );
  }
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
