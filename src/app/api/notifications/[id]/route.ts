import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth';
import { json, route } from '@/server/http';
import type { RouteContext } from '@/server/route-context';

export const dynamic = 'force-dynamic';

export const PATCH = route<RouteContext<{ id: string }>>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  await prisma.notification.updateMany({
    where: { id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  return json({ ok: true });
});
