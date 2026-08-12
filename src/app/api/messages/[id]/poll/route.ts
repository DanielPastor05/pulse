import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import type { RouteContext } from '@/server/route-context';
import { closePoll, votePoll } from '@/server/services/poll.service';

export const dynamic = 'force-dynamic';

const voteSchema = z.object({ optionId: z.string().uuid() });

/** Voting for the option you already chose takes the vote back. */
export const POST = route<RouteContext<{ id: string }>>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await rateLimit(`vote:${user.id}`, rateLimits.mutate);

  const { optionId } = await parseBody(request, voteSchema);
  return json(await votePoll(id, user, optionId));
});

export const PATCH = route<RouteContext<{ id: string }>>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await rateLimit(`close-poll:${user.id}`, rateLimits.mutate);

  return json(await closePoll(id, user));
});
