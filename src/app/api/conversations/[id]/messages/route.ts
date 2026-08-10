import { messagesQuerySchema, sendMessageSchema } from '@/features/messages/validators';
import { requireUser } from '@/server/auth';
import { json, parseBody, parseQuery, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import { requireMembership } from '@/server/repositories/conversation.repository';
import { listMessages } from '@/server/repositories/message.repository';
import type { RouteContext } from '@/server/route-context';
import { sendMessage } from '@/server/services/message.service';

export const dynamic = 'force-dynamic';

type Context = RouteContext<{ id: string }>;

export const GET = route<Context>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await requireMembership(id, user.id);

  const { cursor, limit } = parseQuery(request, messagesQuerySchema);
  return json(await listMessages(id, user.id, { cursor, limit }));
});

export const POST = route<Context>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await rateLimit(`send:${user.id}`, rateLimits.sendMessage);

  const input = await parseBody(request, sendMessageSchema);
  return json(await sendMessage(id, user, input), { status: 201 });
});
