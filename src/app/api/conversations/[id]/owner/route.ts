import { transferOwnershipSchema } from '@/features/conversations/validators';
import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import type { RouteContext } from '@/server/route-context';
import { transferOwnership } from '@/server/services/conversation.service';
import { requireMembership } from '@/server/repositories/conversation.repository';

export const dynamic = 'force-dynamic';

/**
 * Hands the group to another member. Separate from `PATCH .../members/[userId]`
 * because that endpoint assigns ranks and refuses `OWNER` by design — giving a
 * group away demotes the caller, so it is asked for on its own.
 */
export const POST = route<RouteContext<{ id: string }>>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await rateLimit(`owner:${user.id}`, rateLimits.mutate);

  // La pertenencia antes que el esquema: quien no puede estar aquí no
  // debe enterarse de qué forma tiene el cuerpo. Es la misma comprobación
  // que ya hace `transferOwnership`, adelantada; sale de la caché de petición,
  // así que no cuesta una consulta de más.
  await requireMembership(id, user.id);

  const { userId } = await parseBody(request, transferOwnershipSchema);
  return json(await transferOwnership(id, user, userId));
});
