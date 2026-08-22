import { reviewJoinRequestSchema } from '@/features/conversations/validators';
import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import type { RouteContext } from '@/server/route-context';
import { reviewJoinRequest } from '@/server/services/access.service';
import { requireMembership } from '@/server/repositories/conversation.repository';

export const dynamic = 'force-dynamic';

export const PATCH = route<RouteContext<{ id: string; requestId: string }>>(
  async (request, context) => {
    const user = await requireUser();
    const { id, requestId } = await context.params;
    // La pertenencia antes que el esquema: quien no puede estar aquí no
    // debe enterarse de qué forma tiene el cuerpo. Es la misma comprobación
    // que ya hace `reviewJoinRequest`, adelantada; sale de la caché de petición,
    // así que no cuesta una consulta de más.
    await requireMembership(id, user.id);

    const { status } = await parseBody(request, reviewJoinRequestSchema);

    await reviewJoinRequest(id, user, requestId, status);
    return json({ ok: true });
  },
);
