import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth';
import { errors } from '@/server/errors';
import { json, route } from '@/server/http';
import { publicUserSelect, toPublicUser } from '@/server/repositories/selectors';
import type { RouteContext } from '@/server/route-context';

export const dynamic = 'force-dynamic';

export const GET = route<RouteContext<{ username: string }>>(async (_request, context) => {
  const viewer = await requireUser();
  const { username } = await context.params;

  const user = await prisma.user.findUnique({ where: { username }, select: publicUserSelect });
  if (!user) throw errors.notFound('No one goes by that name.');

  const [relationship, blockedByMe] = await Promise.all([
    prisma.relationship.findFirst({
      where: {
        OR: [
          { requesterId: viewer.id, addresseeId: user.id },
          { requesterId: user.id, addresseeId: viewer.id },
        ],
      },
    }),
    prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: user.id } },
    }),
  ]);

  return json({
    user: toPublicUser(user),
    relationship: relationship
      ? {
          id: relationship.id,
          status: relationship.status,
          direction: relationship.requesterId === viewer.id ? 'outgoing' : 'incoming',
        }
      : null,
    blockedByMe: Boolean(blockedByMe),
  });
});
