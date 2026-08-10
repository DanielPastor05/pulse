import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import type { RouteContext } from '@/server/route-context';
import { setStarred } from '@/server/services/message.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ starred: z.boolean() });

export const POST = route<RouteContext<{ id: string }>>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const { starred } = await parseBody(request, bodySchema);
  return json(await setStarred(id, user, starred));
});
