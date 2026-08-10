import { markReadSchema } from '@/features/conversations/validators';
import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import type { RouteContext } from '@/server/route-context';
import { markConversationRead } from '@/server/services/message.service';

export const dynamic = 'force-dynamic';

export const POST = route<RouteContext<{ id: string }>>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const { messageId } = await parseBody(request, markReadSchema);

  await markConversationRead(id, user, messageId);
  return json({ ok: true });
});
