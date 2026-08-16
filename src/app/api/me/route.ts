import { z } from 'zod';

import { updateProfileSchema } from '@/features/profile/validators';
import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import { deleteAccount } from '@/server/services/account.service';
import { toCurrentUser, updateProfile } from '@/server/services/user.service';

export const dynamic = 'force-dynamic';

/**
 * La confirmación viaja en el cuerpo, no sólo en la interfaz.
 *
 * Un DELETE sin cuerpo se dispara con demasiada facilidad — un enlace precargado,
 * una petición repetida, o una petición de otro origen el día que la
 * comprobación de origen falle. Exigir el nombre de usuario exacto hace que
 * borrar sea siempre un acto deliberado y no algo que pueda ocurrirle a alguien.
 */
const deleteSchema = z.object({ confirmation: z.string().min(1) });

export const GET = route(async () => {
  const user = await requireUser();
  return json(toCurrentUser(user));
});

export const PATCH = route(async (request) => {
  const user = await requireUser();
  await rateLimit(`profile:${user.id}`, rateLimits.mutate);
  const input = await parseBody(request, updateProfileSchema);
  return json(await updateProfile(user, input));
});

export const DELETE = route(async (request) => {
  const user = await requireUser();
  await rateLimit(`delete-account:${user.id}`, rateLimits.auth);
  const { confirmation } = await parseBody(request, deleteSchema);

  await deleteAccount(user, confirmation);
  return json({ ok: true });
});
