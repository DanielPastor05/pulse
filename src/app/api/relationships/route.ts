import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import { listRelationships, sendFriendRequest } from '@/server/services/user.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ userId: z.string().uuid() });

export const GET = route(async () => {
  const user = await requireUser();
  return json({ relationships: await listRelationships(user.id) });
});

export const POST = route(async (request) => {
  const user = await requireUser();
  await rateLimit(`friend:${user.id}`, rateLimits.mutate);

  const { userId } = await parseBody(request, bodySchema);
  await sendFriendRequest(user, userId);
  return json({ ok: true }, { status: 201 });
});
