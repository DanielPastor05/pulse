/**
 * Quién está dentro de una conversación, y con qué rango.
 *
 * Añadir, cambiar de rol y expulsar. Las tres pasan por la misma comprobación
 * de rango y las tres dejan rastro en el registro de moderación, así que
 * cambiar esa regla se hace en un sitio y se revisa entera de una vez.
 */

import type { MemberRole, User } from '@prisma/client';
import { can, outranks } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { realtimeEvents } from '@/lib/realtime';
import { broadcastToConversation, broadcastToUsers } from '@/server/broadcast';
import { errors } from '@/server/errors';
import { conversationMemberIds, getConversationDetail, requireMembership } from '@/server/repositories/conversation.repository';
import { recordModeration } from '@/server/services/audit.service';
import { systemMessage, withoutBlocked } from '@/server/services/conversation-shared';
import { deleteConversation } from '@/server/services/conversation.service';
import { notify } from '@/server/services/notification.service';

export async function addMembers(conversationId: string, user: User, userIds: string[]) {
  const membership = await requireMembership(conversationId, user.id);
  if (membership.conversation.type === 'DIRECT') {
    throw errors.badRequest('You cannot add people to a direct message.');
  }
  if (!can.manageMembers(membership.role)) {
    throw errors.forbidden('Only moderators can add members.');
  }

  const existing = await prisma.conversationMember.findMany({
    where: { conversationId, userId: { in: userIds } },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map((member) => member.userId));
  const toAdd = await withoutBlocked(
    user.id,
    userIds.filter((id) => !existingIds.has(id)),
  );
  if (toAdd.length === 0) return getConversationDetail(conversationId, user.id);

  await prisma.conversationMember.createMany({
    data: toAdd.map((userId) => ({ conversationId, userId })),
    skipDuplicates: true,
  });

  const added = await prisma.user.findMany({
    where: { id: { in: toAdd } },
    select: { displayName: true },
  });
  await systemMessage(
    conversationId,
    `${user.displayName} added ${added.map((member) => member.displayName).join(', ')}.`,
  );

  const memberIds = await conversationMemberIds(conversationId);
  await Promise.all([
    broadcastToUsers(memberIds, realtimeEvents.inboxUpdated, { conversationId }),
    broadcastToConversation(conversationId, realtimeEvents.memberChanged, { conversationId }),
    notify({
      userIds: toAdd,
      kind: 'GROUP_INVITE',
      title: `${user.displayName} added you to ${membership.conversation.name ?? 'a group'}`,
      actorId: user.id,
      conversationId,
    }),
  ]);

  return getConversationDetail(conversationId, user.id);
}
export async function updateMember(
  conversationId: string,
  actor: User,
  targetUserId: string,
  input: { role?: Exclude<MemberRole, 'OWNER'>; nickname?: string | null },
) {
  const membership = await requireMembership(conversationId, actor.id);
  const target = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: targetUserId } },
  });
  if (!target) throw errors.notFound('That person is not in this conversation.');

  if (input.role !== undefined) {
    if (!can.assignRoles(membership.role)) throw errors.forbidden('Only admins can change roles.');
    if (target.role === 'OWNER') throw errors.forbidden('The owner cannot be demoted.');
    if (!outranks(membership.role, target.role) && actor.id !== targetUserId) {
      throw errors.forbidden('You cannot change the role of someone at your level.');
    }
  }
  if (input.nickname !== undefined && actor.id !== targetUserId && !can.manageMembers(membership.role)) {
    throw errors.forbidden('You cannot rename other members.');
  }

  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: targetUserId } },
    data: {
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.nickname !== undefined ? { nickname: input.nickname } : {}),
    },
  });

  // Sólo el rol deja rastro: cambiarle el apodo a alguien no es moderar, y
  // registrarlo llenaría el historial de ruido hasta esconder lo que importa.
  if (input.role !== undefined && input.role !== target.role) {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, displayName: true },
    });
    await recordModeration({
      conversationId,
      actor,
      action: 'ROLE_CHANGED',
      target: targetUser,
      detail: `${target.role} → ${input.role}`,
    });
  }

  await broadcastToConversation(conversationId, realtimeEvents.memberChanged, { conversationId });
  return getConversationDetail(conversationId, actor.id);
}
export async function removeMember(conversationId: string, actor: User, targetUserId: string) {
  const membership = await requireMembership(conversationId, actor.id);
  const leaving = actor.id === targetUserId;

  if (!leaving && !can.manageMembers(membership.role)) {
    throw errors.forbidden('Only moderators can remove members.');
  }

  const target = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: targetUserId } },
  });
  if (!target) throw errors.notFound('That person is not in this conversation.');
  if (!leaving && !outranks(membership.role, target.role)) {
    throw errors.forbidden('You cannot remove someone at or above your level.');
  }
  if (target.role === 'OWNER' && leaving) {
    const others = await prisma.conversationMember.count({
      where: { conversationId, userId: { not: actor.id } },
    });
    // Alone in your own group there is nobody to hand it to, so leaving means
    // deleting it. Telling someone to transfer ownership to no one is a dead
    // end, and it is how the owner used to get stuck here.
    if (others === 0) {
      await deleteConversation(conversationId, actor);
      return;
    }
    throw errors.badRequest('Hand the group over to another member before leaving.');
  }

  const memberIds = await conversationMemberIds(conversationId);

  await prisma.conversationMember.delete({
    where: { conversationId_userId: { conversationId, userId: targetUserId } },
  });

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, displayName: true },
  });

  // Irse por voluntad propia no es una acción de moderación, así que sólo se
  // registra cuando fue otra persona quien te sacó.
  if (!leaving) {
    await recordModeration({
      conversationId,
      actor,
      action: 'MEMBER_REMOVED',
      target: targetUser,
    });
  }

  await systemMessage(
    conversationId,
    leaving
      ? `${targetUser?.displayName ?? 'Someone'} left.`
      : `${actor.displayName} removed ${targetUser?.displayName ?? 'someone'}.`,
  );

  await Promise.all([
    broadcastToUsers(memberIds, realtimeEvents.inboxUpdated, { conversationId }),
    broadcastToConversation(conversationId, realtimeEvents.memberChanged, { conversationId }),
  ]);
}
