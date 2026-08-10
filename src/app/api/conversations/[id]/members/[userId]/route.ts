import { updateMemberSchema } from '@/features/conversations/validators';
import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import type { RouteContext } from '@/server/route-context';
import { removeMember, updateMember } from '@/server/services/conversation.service';

export const dynamic = 'force-dynamic';

type Context = RouteContext<{ id: string; userId: string }>;

export const PATCH = route<Context>(async (request, context) => {
  const actor = await requireUser();
  const { id, userId } = await context.params;
  const input = await parseBody(request, updateMemberSchema);
  return json(await updateMember(id, actor, userId, input));
});

export const DELETE = route<Context>(async (_request, context) => {
  const actor = await requireUser();
  const { id, userId } = await context.params;
  await removeMember(id, actor, userId);
  return json({ ok: true });
});
