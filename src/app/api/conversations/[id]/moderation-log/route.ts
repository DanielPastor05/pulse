import { requireUser } from '@/server/auth';
import { json, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import type { RouteContext } from '@/server/route-context';
import { listModerationEvents } from '@/server/services/audit.service';

export const dynamic = 'force-dynamic';

/** Quién hizo qué en esta conversación. Sólo para quien modera. */
export const GET = route<RouteContext<{ id: string }>>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await rateLimit(`audit:${user.id}`, rateLimits.search);

  return json({ events: await listModerationEvents(id, user) });
});
