import { updateConversationSchema } from '@/features/conversations/validators';
import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import { getConversationDetail, requireMembership } from '@/server/repositories/conversation.repository';
import type { RouteContext } from '@/server/route-context';
import { deleteConversation, updateConversation } from '@/server/services/conversation.service';

export const dynamic = 'force-dynamic';

type Context = RouteContext<{ id: string }>;

export const GET = route<Context>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  return json(await getConversationDetail(id, user.id));
});

export const PATCH = route<Context>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await rateLimit(`conversation:${user.id}`, rateLimits.mutate);
  // La pertenencia antes que el esquema: quien no puede estar aquí no
  // debe enterarse de qué forma tiene el cuerpo. Es la misma comprobación
  // que ya hace `updateConversation`, adelantada; sale de la caché de petición,
  // así que no cuesta una consulta de más.
  await requireMembership(id, user.id);

  const input = await parseBody(request, updateConversationSchema);
  return json(await updateConversation(id, user, input));
});

export const DELETE = route<Context>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await deleteConversation(id, user);
  return json({ ok: true });
});
