import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { json, parseQuery, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import type { RouteContext } from '@/server/route-context';
import { listModerationEvents } from '@/server/services/audit.service';

export const dynamic = 'force-dynamic';

const querySchema = z.object({ cursor: z.string().uuid().optional() });

/**
 * Quién hizo qué en esta conversación. Sólo para quien modera.
 *
 * Paginado: antes devolvía las cien últimas y ahí se acababa el historial. Un
 * registro de auditoría que pierde entradas sin decirlo no sirve para lo único
 * para lo que sirve un registro de auditoría.
 */
export const GET = route<RouteContext<{ id: string }>>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await rateLimit(`audit:${user.id}`, rateLimits.search);

  const { cursor } = parseQuery(request, querySchema);
  const page = await listModerationEvents(id, user, { cursor });

  // `events` se conserva para no romper a quien ya lo lee, con el cursor al
  // lado.
  return json({ events: page.items, nextCursor: page.nextCursor });
});
