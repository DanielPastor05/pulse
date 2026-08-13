import { requireUser } from '@/server/auth';
import { errors } from '@/server/errors';
import { json, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import { requireMembership } from '@/server/repositories/conversation.repository';
import { listThread } from '@/server/repositories/message.repository';
import { prisma } from '@/lib/prisma';
import type { RouteContext } from '@/server/route-context';

export const dynamic = 'force-dynamic';

export const GET = route<RouteContext<{ id: string }>>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await rateLimit(`thread:${user.id}`, rateLimits.search);

  // Membership is checked against the message's own conversation: without this
  // any message id would expose a branch of a conversation you are not in.
  const message = await prisma.message.findUnique({
    where: { id },
    select: { conversationId: true },
  });
  if (!message) throw errors.notFound('That message no longer exists.');
  await requireMembership(message.conversationId, user.id);

  const thread = await listThread(id, user.id);
  if (!thread) throw errors.notFound('That message no longer exists.');

  return json(thread);
});
