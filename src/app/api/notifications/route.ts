import { prisma } from '@/lib/prisma';
import { NOTIFICATION_PAGE_SIZE } from '@/lib/constants';
import { requireUser } from '@/server/auth';
import { json, route } from '@/server/http';
import { notificationInclude, toNotification } from '@/server/repositories/selectors';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const user = await requireUser();

  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      include: notificationInclude,
      orderBy: { createdAt: 'desc' },
      take: NOTIFICATION_PAGE_SIZE,
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return json({ notifications: rows.map(toNotification), unread });
});

/** Marks everything as read. */
export const POST = route(async () => {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return json({ ok: true });
});
