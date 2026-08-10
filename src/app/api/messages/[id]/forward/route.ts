import { forwardMessageSchema } from '@/features/messages/validators';
import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import type { RouteContext } from '@/server/route-context';
import { forwardMessage } from '@/server/services/message.service';

export const dynamic = 'force-dynamic';

export const POST = route<RouteContext<{ id: string }>>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await rateLimit(`forward:${user.id}`, rateLimits.sendMessage);

  const { conversationIds } = await parseBody(request, forwardMessageSchema);
  return json({ delivered: await forwardMessage(id, user, conversationIds) });
});
