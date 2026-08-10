import { addMembersSchema } from '@/features/conversations/validators';
import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import type { RouteContext } from '@/server/route-context';
import { addMembers } from '@/server/services/conversation.service';

export const dynamic = 'force-dynamic';

export const POST = route<RouteContext<{ id: string }>>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await rateLimit(`members:${user.id}`, rateLimits.mutate);

  const { userIds } = await parseBody(request, addMembersSchema);
  return json(await addMembers(id, user, userIds));
});
