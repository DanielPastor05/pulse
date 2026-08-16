import { requireUser } from '@/server/auth';
import { route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import { exportAccount } from '@/server/services/account.service';

export const dynamic = 'force-dynamic';

/**
 * Tus datos, para descargar.
 *
 * Se sirve como adjunto y no como JSON normal porque el destino de esto es el
 * disco de alguien, no el `fetch` de la aplicación. El límite de tasa es el de
 * mutación pese a ser una lectura: recorre todo el historial de una cuenta, así
 * que cuesta más que cualquier GET de los otros y no debe poder pedirse en
 * bucle.
 */
export const GET = route(async () => {
  const user = await requireUser();
  await rateLimit(`export:${user.id}`, rateLimits.mutate);

  const data = await exportAccount(user);
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="pulse-${user.username}-${stamp}.json"`,
      // Nunca en una caché compartida: es el historial de una persona.
      'cache-control': 'private, no-store',
    },
  });
});
