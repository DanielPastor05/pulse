import { requireUser } from '@/server/auth';
import { json, route } from '@/server/http';
import { listStarredMessages } from '@/server/repositories/message.repository';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const user = await requireUser();
  return json({ messages: await listStarredMessages(user.id) });
});
