import { requireUser } from '@/server/auth';
import { json, route } from '@/server/http';
import { requireMembership } from '@/server/repositories/conversation.repository';
import { listPinnedMessages } from '@/server/repositories/message.repository';
import type { RouteContext } from '@/server/route-context';

export const dynamic = 'force-dynamic';

export const GET = route<RouteContext<{ id: string }>>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await requireMembership(id, user.id);
  return json({ messages: await listPinnedMessages(id, user.id) });
});
