import { requireUser } from '@/server/auth';
import { json, route } from '@/server/http';
import { cancelarProgramado } from '@/server/services/scheduled.service';
import type { RouteContext } from '@/server/route-context';

export const dynamic = 'force-dynamic';

/**
 * Cancelar uno.
 *
 * No hace falta comprobar la pertenencia a la conversación: el servicio borra
 * por `(id, authorId)`, así que sólo puede alcanzar filas propias. Comprobar
 * además la conversación no añadiría ninguna garantía y sí una consulta.
 */
export const DELETE = route<RouteContext<{ id: string; scheduledId: string }>>(
  async (_request, context) => {
    const user = await requireUser();
    const { scheduledId } = await context.params;

    await cancelarProgramado(scheduledId, user.id);

    return json({ ok: true });
  },
);
