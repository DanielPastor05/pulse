import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { json, parseQuery, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import type { RouteContext } from '@/server/route-context';
import { listReports } from '@/server/services/report.service';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED', 'DISMISSED']).default('OPEN'),
});

/** The moderation queue. `listReports` enforces the role. */
export const GET = route<RouteContext<{ id: string }>>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await rateLimit(`reports:${user.id}`, rateLimits.search);

  const { status } = parseQuery(request, querySchema);
  return json({ reports: await listReports(id, user, status) });
});
