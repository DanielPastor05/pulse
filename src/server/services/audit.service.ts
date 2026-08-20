import type { ModerationAction, User } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { MODERATION_PAGE_SIZE } from '@/lib/constants';
import { can } from '@/lib/permissions';
import { errors } from '@/server/errors';
import { describeError, log } from '@/server/logger';
import { requireMembership } from '@/server/repositories/conversation.repository';

type RecordInput = {
  conversationId: string;
  actor: Pick<User, 'id' | 'displayName'>;
  action: ModerationAction;
  target?: Pick<User, 'id' | 'displayName'> | null;
  detail?: string | null;
};

/**
 * Deja constancia de una acción de moderación.
 *
 * Los nombres se copian en texto además de guardar los ids. Las claves son
 * `SetNull`, así que cuando alguien borra su cuenta el registro sobrevive pero
 * pierde a quién apuntaba — y un historial que dice «alguien expulsó a alguien»
 * no sirve para nada. El nombre del momento es lo que lo mantiene legible.
 *
 * Nunca lanza. Registrar es una obligación con quien modera, no con quien pidió
 * la acción: si falla el registro, expulsar a alguien no debe fallar también.
 * Pero se avisa, porque una auditoría que se cae en silencio es peor que no
 * tenerla — deja creer que el hueco no existe.
 */
export async function recordModeration(input: RecordInput): Promise<void> {
  try {
    await prisma.moderationEvent.create({
      data: {
        conversationId: input.conversationId,
        actorId: input.actor.id,
        actorName: input.actor.displayName,
        targetId: input.target?.id ?? null,
        targetName: input.target?.displayName ?? null,
        action: input.action,
        detail: input.detail ?? null,
      },
    });
  } catch (error) {
    log.error('audit.record_failed', {
      conversationId: input.conversationId,
      action: input.action,
      ...describeError(error),
    });
  }
}

/** El historial de una conversación. Misma puerta que las denuncias. */
export async function listModerationEvents(
  conversationId: string,
  actor: User,
  options: { cursor?: string | null; limit?: number } = {},
) {
  const membership = await requireMembership(conversationId, actor.id);
  if (!can.moderateMessages(membership.role)) {
    throw errors.forbidden('Only moderators can see the moderation log.');
  }

  const limit = Math.min(options.limit ?? MODERATION_PAGE_SIZE, 100);

  const rows = await prisma.moderationEvent.findMany({
    where: { conversationId },
    // El desempate por `id` es lo que hace el orden total. Un registro de
    // auditoria que se salta una entrada al pasar de pagina no sirve para lo
    // unico que sirve un registro de auditoria.
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });

  // Antes eran cien y se acababa ahi. Una conversacion con mas historial que eso
  // lo perdia sin decirlo.
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: page.map((event) => ({
      id: event.id,
      action: event.action,
      actorName: event.actorName,
      targetName: event.targetName,
      detail: event.detail,
      createdAt: event.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  };
}
