import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { json, parseQuery, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import { searchUsers } from '@/server/services/user.service';

export const dynamic = 'force-dynamic';

const querySchema = z.object({ q: z.string().max(80).default('') });

export const GET = route(async (request) => {
  const user = await requireUser();
  await rateLimit(`user-search:${user.id}`, rateLimits.search);
  const { q } = parseQuery(request, querySchema);
  return json({ users: await searchUsers(user.id, q) });
});
