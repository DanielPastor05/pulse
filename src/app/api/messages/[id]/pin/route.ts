import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import type { RouteContext } from '@/server/route-context';
import { setPinned } from '@/server/services/message.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ pinned: z.boolean() });

export const POST = route<RouteContext<{ id: string }>>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const { pinned } = await parseBody(request, bodySchema);
  return json(await setPinned(id, user, pinned));
});
