import { editMessageSchema } from '@/features/messages/validators';
import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import type { RouteContext } from '@/server/route-context';
import { deleteMessage, editMessage } from '@/server/services/message.service';

export const dynamic = 'force-dynamic';

type Context = RouteContext<{ id: string }>;

export const PATCH = route<Context>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await rateLimit(`edit:${user.id}`, rateLimits.mutate);

  const { content } = await parseBody(request, editMessageSchema);
  return json(await editMessage(id, user, content));
});

export const DELETE = route<Context>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await deleteMessage(id, user);
  return json({ ok: true });
});
