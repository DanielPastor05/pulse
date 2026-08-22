import { updateMemberSchema } from '@/features/conversations/validators';
import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import type { RouteContext } from '@/server/route-context';
import { removeMember, updateMember } from '@/server/services/membership.service';
import { requireMembership } from '@/server/repositories/conversation.repository';

export const dynamic = 'force-dynamic';

type Context = RouteContext<{ id: string; userId: string }>;

export const PATCH = route<Context>(async (request, context) => {
  const actor = await requireUser();
  const { id, userId } = await context.params;
  // La pertenencia antes que el esquema: quien no puede estar aquí no
  // debe enterarse de qué forma tiene el cuerpo. Es la misma comprobación
  // que ya hace `updateMember`, adelantada; sale de la caché de petición,
  // así que no cuesta una consulta de más.
  await requireMembership(id, actor.id);

  const input = await parseBody(request, updateMemberSchema);
  return json(await updateMember(id, actor, userId, input));
});

export const DELETE = route<Context>(async (_request, context) => {
  const actor = await requireUser();
  const { id, userId } = await context.params;
  await removeMember(id, actor, userId);
  return json({ ok: true });
});
