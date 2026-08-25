import { scheduleMessageSchema } from '@/features/messages/validators';
import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { listarProgramados, programarMensaje } from '@/server/services/scheduled.service';
import type { RouteContext } from '@/server/route-context';

export const dynamic = 'force-dynamic';

/** Lo que a quien pregunta le queda por salir aquí. Nunca lo de otra persona. */
export const GET = route<RouteContext<{ id: string }>>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  return json({ scheduled: await listarProgramados(id, user.id) });
});

/** Escribir ahora para que salga más tarde. */
export const POST = route<RouteContext<{ id: string }>>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  const input = await parseBody(request, scheduleMessageSchema);
  const scheduled = await programarMensaje(id, user, input);

  return json({ scheduled }, { status: 201 });
});
