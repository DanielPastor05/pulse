import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { json, parseQuery, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import { globalSearch } from '@/server/services/search.service';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  q: z.string().max(120).default(''),
  scope: z.enum(['all', 'users', 'conversations', 'messages', 'files']).default('all'),
  cursor: z.string().max(120).optional(),
});

export const GET = route(async (request) => {
  const user = await requireUser();
  await rateLimit(`search:${user.id}`, rateLimits.search);

  const { q, scope, cursor } = parseQuery(request, querySchema);
  return json(await globalSearch(user.id, q, scope, cursor));
});
