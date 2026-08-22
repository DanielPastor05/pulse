import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import type { RouteContext } from '@/server/route-context';
import { ringConversation } from '@/server/services/call.service';
import { requireMembership } from '@/server/repositories/conversation.repository';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  callId: z.string().uuid(),
  mode: z.enum(['audio', 'video']),
});

/**
 * Rings the other members. Only the invite goes through the server — the
 * signalling that follows is peer to peer over the conversation's channel.
 */
export const POST = route<RouteContext<{ id: string }>>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await rateLimit(`call:${user.id}`, rateLimits.mutate);

  // La pertenencia antes que el esquema: quien no puede estar aquí no
  // debe enterarse de qué forma tiene el cuerpo. Es la misma comprobación
  // que ya hace `ringConversation`, adelantada; sale de la caché de petición,
  // así que no cuesta una consulta de más.
  await requireMembership(id, user.id);

  const input = await parseBody(request, bodySchema);
  await ringConversation(id, user, input);
  return json({ ok: true }, { status: 201 });
});
