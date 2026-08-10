import type { NotificationKind } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { realtimeEvents } from '@/lib/realtime';
import { broadcastToUsers } from '@/server/broadcast';
import { notificationInclude, toNotification } from '@/server/repositories/selectors';

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
 * private realtime channel. Muted conversations are filtered here so no call
 * site has to remember to do it.
 */
export async function notify(input: NotificationInput): Promise<void> {
  const recipients = input.actorId
    ? input.userIds.filter((id) => id !== input.actorId)
    : input.userIds;
  if (recipients.length === 0) return;

  let allowed = recipients;
  if (input.conversationId) {
    const members = await prisma.conversationMember.findMany({
      where: { conversationId: input.conversationId, userId: { in: recipients }, muted: false },
      select: { userId: true },
    });
    allowed = members.map((member) => member.userId);
  }
  if (allowed.length === 0) return;

  const created = await Promise.all(
    allowed.map((userId) =>
      prisma.notification.create({
        data: {
          userId,
          kind: input.kind,
          title: input.title,
          body: input.body ?? null,
          actorId: input.actorId ?? null,
          conversationId: input.conversationId ?? null,
          messageId: input.messageId ?? null,
        },
        include: notificationInclude,
      }),
    ),
  );

  await Promise.all(
    created.map((notification) =>
      broadcastToUsers([notification.userId], realtimeEvents.notification, {
        notification: toNotification(notification),
      }),
    ),
  );
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
