import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth';
import { errors } from '@/server/errors';
import { json, route } from '@/server/http';
import { requireMembership } from '@/server/repositories/conversation.repository';
import { publicUserSelect, toPublicUser } from '@/server/repositories/selectors';
import type { RouteContext } from '@/server/route-context';
import { can } from '@/lib/permissions';
import type { JoinRequestDTO } from '@/types/dto';

export const dynamic = 'force-dynamic';

export const GET = route<RouteContext<{ id: string }>>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  const membership = await requireMembership(id, user.id);
  if (!can.reviewJoinRequests(membership.role)) {
    throw errors.forbidden('You cannot review join requests.');
  }

  const requests = await prisma.joinRequest.findMany({
    where: { conversationId: id, status: 'PENDING' },
    include: { user: { select: publicUserSelect } },
    orderBy: { createdAt: 'asc' },
  });

  const items: JoinRequestDTO[] = requests.map((request) => ({
    id: request.id,
    status: request.status,
    message: request.message,
    createdAt: request.createdAt.toISOString(),
    user: toPublicUser(request.user),
  }));

  return json({ requests: items });
});
