import { reactionSchema } from '@/features/messages/validators';
import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import type { RouteContext } from '@/server/route-context';
import { toggleReaction } from '@/server/services/message.service';

export const dynamic = 'force-dynamic';

export const POST = route<RouteContext<{ id: string }>>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await rateLimit(`react:${user.id}`, rateLimits.mutate);

  const { emoji } = await parseBody(request, reactionSchema);
  return json(await toggleReaction(id, user, emoji));
});
