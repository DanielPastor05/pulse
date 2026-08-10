import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import type { RouteContext } from '@/server/route-context';
import { removeRelationship, respondToFriendRequest } from '@/server/services/user.service';

export const dynamic = 'force-dynamic';

type Context = RouteContext<{ id: string }>;

const bodySchema = z.object({ accept: z.boolean() });

export const PATCH = route<Context>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const { accept } = await parseBody(request, bodySchema);

  await respondToFriendRequest(user, id, accept);
  return json({ ok: true });
});

export const DELETE = route<Context>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await removeRelationship(user, id);
  return json({ ok: true });
});
