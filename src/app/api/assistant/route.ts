import { requireUser } from '@/server/auth';
import { errors } from '@/server/errors';
import { json, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import {
  findOrCreateDirectConversation,
  getConversationDetail,
} from '@/server/repositories/conversation.repository';
import { asegurarAsistente, asistenteDisponible } from '@/server/services/assistant.service';

export const dynamic = 'force-dynamic';

/**
 * Abrir el hilo con el asistente, creándolo la primera vez.
 *
 * Todo lo que sigue después es la conversación directa de siempre: el mismo
 * `findOrCreateDirectConversation` que se usa para escribir a una persona, la
 * misma pantalla, los mismos permisos. Lo único que esta ruta añade es
 * asegurarse de que la cuenta existe, porque no se crea sola en una migración.
 */
export const POST = route(async () => {
  const user = await requireUser();
  await rateLimit(`assistant-open:${user.id}`, rateLimits.mutate);

  // Sin credenciales de Workers AI la cuenta no debe ni crearse: un hilo con
  // alguien que nunca contesta es peor que no ofrecerlo.
  if (!asistenteDisponible()) {
    throw errors.badRequest('The assistant is not configured on this deployment.');
  }

  const asistente = await asegurarAsistente();
  const conversationId = await findOrCreateDirectConversation(user.id, asistente.id);

  return json(await getConversationDetail(conversationId, user.id), { status: 201 });
});
