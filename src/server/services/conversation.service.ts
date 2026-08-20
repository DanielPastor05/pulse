/**
 * La conversación en sí: crearla, cambiarla, entregarla y borrarla.
 *
 * Estaba junto a los miembros y a las invitaciones en un solo fichero de casi
 * quinientas líneas. Las tres cosas comparten sustantivo pero no motivo para
 * cambiar, que es lo que decide dónde va el corte: quien toca las reglas de
 * quién puede expulsar a quién no está tocando cómo se canjea un enlace.
 */

import type { MemberRole, User } from '@prisma/client';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { realtimeEvents } from '@/lib/realtime';
import { broadcastToConversation, broadcastToUsers } from '@/server/broadcast';
import { errors } from '@/server/errors';
import { conversationMemberIds, getConversationDetail, requireMembership } from '@/server/repositories/conversation.repository';
import { systemMessage, withoutBlocked } from '@/server/services/conversation-shared';
import { notify } from '@/server/services/notification.service';
import type { CreateGroupInput, UpdateConversationInput } from '@/features/conversations/validators';
import type { ConversationDetail } from '@/types/dto';

export async function createGroup(owner: User, input: CreateGroupInput): Promise<ConversationDetail> {
  const requested = [...new Set(input.memberIds.filter((id) => id !== owner.id))];

  if (requested.length > 0) {
    const existing = await prisma.user.count({ where: { id: { in: requested } } });
    if (existing !== requested.length) throw errors.badRequest('Some members no longer exist.');
  }

  const memberIds = await withoutBlocked(owner.id, requested);

  const conversation = await prisma.conversation.create({
    data: {
      type: 'GROUP',
      name: input.name,
      description: input.description?.trim() || null,
      avatarUrl: input.avatarUrl ?? null,
      accent: input.accent,
      isPublic: input.isPublic,
      requiresApproval: input.isPublic ? input.requiresApproval : false,
      slug: input.isPublic ? (input.slug ?? null) : null,
      ownerId: owner.id,
      members: {
        createMany: {
          data: [
            { userId: owner.id, role: 'OWNER' as MemberRole },
            ...memberIds.map((userId) => ({ userId, role: 'MEMBER' as MemberRole })),
          ],
        },
      },
    },
    select: { id: true },
  });

  await systemMessage(conversation.id, `${owner.displayName} created the group.`);

  await Promise.all([
    broadcastToUsers([owner.id, ...memberIds], realtimeEvents.inboxUpdated, {
      conversationId: conversation.id,
    }),
    notify({
      userIds: memberIds,
      kind: 'GROUP_INVITE',
      title: `${owner.displayName} added you to ${input.name}`,
      actorId: owner.id,
      conversationId: conversation.id,
    }),
  ]);

  return getConversationDetail(conversation.id, owner.id);
}
export async function updateConversation(
  conversationId: string,
  user: User,
  input: UpdateConversationInput,
): Promise<ConversationDetail> {
  const membership = await requireMembership(conversationId, user.id);
  if (membership.conversation.type === 'DIRECT') {
    throw errors.badRequest('Direct conversations cannot be renamed.');
  }
  if (!can.editConversation(membership.role)) {
    throw errors.forbidden('Only admins can change group settings.');
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      ...(input.accent !== undefined ? { accent: input.accent } : {}),
      ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
      ...(input.requiresApproval !== undefined ? { requiresApproval: input.requiresApproval } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
    },
  });

  const memberIds = await conversationMemberIds(conversationId);
  await Promise.all([
    broadcastToConversation(conversationId, realtimeEvents.conversationUpdated, { conversationId }),
    broadcastToUsers(memberIds, realtimeEvents.inboxUpdated, { conversationId }),
  ]);

  return getConversationDetail(conversationId, user.id);
}
/**
 * Hands a group over to another member.
 *
 * Deliberately not part of `updateMember`: that endpoint assigns ranks, and
 * `OWNER` is excluded from it on purpose. Giving a group away is not a
 * promotion — it is one action that demotes the person doing it, so it needs to
 * be asked for explicitly rather than fall out of a role dropdown.
 *
 * Without this, `removeMember` told the owner to "transfer ownership before
 * leaving" and there was no way to do it: whoever created a group could never
 * leave it.
 */
export async function transferOwnership(
  conversationId: string,
  actor: User,
  targetUserId: string,
): Promise<ConversationDetail> {
  const membership = await requireMembership(conversationId, actor.id);
  if (membership.role !== 'OWNER') throw errors.forbidden('Only the owner can hand the group over.');
  if (targetUserId === actor.id) throw errors.badRequest('You already own this group.');

  const target = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: targetUserId } },
    select: { userId: true },
  });
  if (!target) throw errors.notFound('That person is not in this conversation.');

  // Both rows move together: a failure between them would leave the group with
  // two owners or none.
  await prisma.$transaction([
    prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: actor.id } },
      data: { role: 'ADMIN' },
    }),
    prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: targetUserId } },
      data: { role: 'OWNER' },
    }),
  ]);

  const newOwner = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { displayName: true },
  });
  await systemMessage(
    conversationId,
    `${actor.displayName} made ${newOwner?.displayName ?? 'someone'} the owner.`,
  );

  await broadcastToConversation(conversationId, realtimeEvents.memberChanged, { conversationId });
  return getConversationDetail(conversationId, actor.id);
}
export async function deleteConversation(conversationId: string, user: User) {
  const membership = await requireMembership(conversationId, user.id);
  if (!can.deleteConversation(membership.role)) {
    throw errors.forbidden('Only the owner can delete this group.');
  }
  const memberIds = await conversationMemberIds(conversationId);
  await prisma.conversation.delete({ where: { id: conversationId } });
  await broadcastToUsers(memberIds, realtimeEvents.inboxUpdated, { conversationId });
}
