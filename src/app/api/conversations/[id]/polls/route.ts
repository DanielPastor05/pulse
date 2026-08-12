import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import type { RouteContext } from '@/server/route-context';
import { createPoll } from '@/server/services/poll.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  question: z.string().trim().min(1).max(300),
  options: z.array(z.string().trim().min(1).max(150)).min(2).max(10),
  multiple: z.boolean().default(false),
});

/** Rate-limited as a send, because that is what it is. */
export const POST = route<RouteContext<{ id: string }>>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await rateLimit(`poll:${user.id}`, rateLimits.sendMessage);

  const input = await parseBody(request, bodySchema);
  return json(await createPoll(id, user, input), { status: 201 });
});
