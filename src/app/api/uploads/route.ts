import { z } from 'zod';

import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES, STORAGE_BUCKETS, tipoBase } from '@/lib/constants';
import { randomId } from '@/lib/utils';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAuthUser, getSessionUser } from '@/server/auth';
import { errors } from '@/server/errors';
import { json, parseBody, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  bucket: z.enum(['attachments', 'avatars']).default('attachments'),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(160),
  size: z.number().int().positive(),
});

/** Strips path traversal and anything that would confuse object storage. */
function safeName(name: string) {
  const cleaned = name
    .replace(/[/\\]/g, '_')
    .replace(/[^\w.\- ]/g, '')
    .trim()
    .slice(-120);
  return cleaned.length > 0 ? cleaned : 'file';
}

function isAllowed(mimeType: string) {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

/**
 * Issues a short-lived signed upload URL. The browser uploads straight to
 * storage — bytes never pass through the app server — and the object path is
 * always namespaced under the uploader's id.
 *
 * Signed with the caller's own session, not the service role. The storage
 * policy already restricts INSERT to `<uid>/…`, so RLS is what grants the URL
 * rather than something the server overrides: a bug in this handler cannot mint
 * a URL that writes outside the uploader's folder. It also means uploads work
 * without the service-role key in the environment.
 */
export const POST = route(async (request) => {
  /*
   * `getAuthUser` y no `requireUser`, y esto era un fallo que bloqueaba el alta.
   *
   * `requireUser` exige la **fila de perfil**, que durante el registro todavía
   * no existe: se crea al terminar `/api/me/onboarding`. Así que quien elegía
   * foto en ese formulario recibía un 401 «You need to sign in to do that» —
   * literalmente «no tienes cuenta» mientras la estaba creando. Lo reportó la
   * primera persona que se registró.
   *
   * El id es el mismo en los dos casos (el perfil se crea con `id: authUser.id`),
   * así que la carpeta y la política de Storage no cambian.
   */
  const authUser = await getAuthUser();
  if (!authUser) throw errors.unauthorized();

  await rateLimit(`upload:${authUser.id}`, rateLimits.upload);

  const input = await parseBody(request, bodySchema);

  // La relajación llega hasta aquí y no más: sin perfil sólo se sube el avatar,
  // que es lo único que hace falta para completar el alta. Un adjunto exige una
  // cuenta terminada — y quien no la tiene tampoco está en ninguna conversación
  // donde ponerlo.
  if (input.bucket !== 'avatars') {
    const perfil = await getSessionUser();
    if (!perfil) throw errors.unauthorized();
  }

  if (input.size > MAX_UPLOAD_BYTES) {
    throw errors.badRequest('That file is larger than 50 MB.');
  }

  // El tipo, sin el códec que le pega `MediaRecorder`. Ver `tipoBase`.
  const mimeType = tipoBase(input.mimeType);
  if (!isAllowed(mimeType)) {
    throw errors.badRequest('That file type is not supported.');
  }

  const bucket =
    input.bucket === 'avatars' ? STORAGE_BUCKETS.avatars : STORAGE_BUCKETS.attachments;
  const path = `${authUser.id}/${Date.now()}-${randomId(6)}-${safeName(input.fileName)}`;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);

  if (error || !data) {
    throw errors.badRequest(error?.message ?? 'Could not prepare the upload.');
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);

  return json({ bucket, path, token: data.token, signedUrl: data.signedUrl, publicUrl });
});
