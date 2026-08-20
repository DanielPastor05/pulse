/**
 * Las dos reglas que toda mutación de una conversación tiene que respetar.
 *
 * Viven aparte porque las comparten los tres módulos que salieron de dividir
 * `conversation.service`, y duplicarlas sería la forma de que dentro de unos
 * meses sólo una de las tres siguiera bloqueando de verdad.
 */

import { prisma } from '@/lib/prisma';
import { realtimeEvents } from '@/lib/realtime';
import { broadcastToConversation } from '@/server/broadcast';

/**
 * Drops anyone who has a block in either direction with the actor.
 *
 * Blocking has to stop the other person putting you in a room with them, not
 * just stop the DM. Without this the block is cosmetic: create a group, add the
 * person who blocked you, and you are talking to them again.
 *
 * Excluded silently rather than rejected — an error saying "that person blocked
 * you" hands the information straight back to the harasser.
 */
export async function withoutBlocked(actorId: string, userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];

  const blocks = await prisma.block.findMany({
    where: {
      OR: [
        { blockerId: actorId, blockedId: { in: userIds } },
        { blockedId: actorId, blockerId: { in: userIds } },
      ],
    },
    select: { blockerId: true, blockedId: true },
  });
  if (blocks.length === 0) return userIds;

  const excluded = new Set(blocks.flatMap((block) => [block.blockerId, block.blockedId]));
  excluded.delete(actorId);
  return userIds.filter((id) => !excluded.has(id));
}

export async function systemMessage(conversationId: string, content: string) {
  const message = await prisma.message.create({
    data: { conversationId, kind: 'SYSTEM', content },
    select: { id: true },
  });
  await broadcastToConversation(conversationId, realtimeEvents.conversationUpdated, {
    conversationId,
    systemMessageId: message.id,
  });
}
