import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import type { RouteContext } from '@/server/route-context';
import { createPoll } from '@/server/services/poll.service';
import { requireMembership } from '@/server/repositories/conversation.repository';

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

  // La pertenencia antes que el esquema: quien no puede estar aquí no
  // debe enterarse de qué forma tiene el cuerpo. Es la misma comprobación
  // que ya hace `createPoll`, adelantada; sale de la caché de petición,
  // así que no cuesta una consulta de más.
  await requireMembership(id, user.id);

  const input = await parseBody(request, bodySchema);
  return json(await createPoll(id, user, input), { status: 201 });
});
