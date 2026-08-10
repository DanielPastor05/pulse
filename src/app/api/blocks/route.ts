import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import { listBlocked, setBlocked } from '@/server/services/user.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ userId: z.string().uuid(), blocked: z.boolean() });

export const GET = route(async () => {
  const user = await requireUser();
  return json({ users: await listBlocked(user.id) });
});

export const POST = route(async (request) => {
  const user = await requireUser();
  await rateLimit(`block:${user.id}`, rateLimits.mutate);

  const { userId, blocked } = await parseBody(request, bodySchema);
  await setBlocked(user, userId, blocked);
  return json({ ok: true });
});
