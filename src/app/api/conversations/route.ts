import { z } from 'zod';

import { createGroupSchema } from '@/features/conversations/validators';
import { requireUser } from '@/server/auth';
import { json, parseBody, parseQuery, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import { listConversations } from '@/server/repositories/conversation.repository';
import { createGroup } from '@/server/services/conversation.service';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  archived: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export const GET = route(async (request) => {
  const user = await requireUser();
  const { archived } = parseQuery(request, querySchema);
  return json({ conversations: await listConversations(user.id, { archived }) });
});

export const POST = route(async (request) => {
  const user = await requireUser();
  await rateLimit(`create-group:${user.id}`, rateLimits.mutate);
  const input = await parseBody(request, createGroupSchema);
  return json(await createGroup(user, input), { status: 201 });
});
