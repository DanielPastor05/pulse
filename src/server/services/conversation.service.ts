import type { MemberRole, User } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { realtimeEvents } from '@/lib/realtime';
import { randomId } from '@/lib/utils';
import { broadcastToConversation, broadcastToUsers } from '@/server/broadcast';
import { errors } from '@/server/errors';
import {
  conversationMemberIds,
  getConversationDetail,
  requireMembership,
} from '@/server/repositories/conversation.repository';
import { can, outranks } from '@/lib/permissions';
import { recordModeration } from '@/server/services/audit.service';
import { notify } from '@/server/services/notification.service';
import type {
  CreateGroupInput,
  UpdateConversationInput,
} from '@/features/conversations/validators';
import type { ConversationDetail } from '@/types/dto';

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
async function withoutBlocked(actorId: string, userIds: string[]): Promise<string[]> {
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

async function systemMessage(conversationId: string, content: string) {
  const message = await prisma.message.create({
    data: { conversationId, kind: 'SYSTEM', content },
    select: { id: true },
  });
  await broadcastToConversation(conversationId, realtimeEvents.conversationUpdated, {
    conversationId,
    systemMessageId: message.id,
  });
}

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

export async function createInvite(
  conversationId: string,
  user: User,
  options: { maxUses?: number | null; expiresInHours?: number | null },
) {
  const membership = await requireMembership(conversationId, user.id);
  if (!can.createInvite(membership.role)) throw errors.forbidden('You cannot create invites.');

  return prisma.invite.create({
    data: {
      code: randomId(10),
      conversationId,
      createdById: user.id,
      maxUses: options.maxUses ?? null,
      expiresAt: options.expiresInHours
        ? new Date(Date.now() + options.expiresInHours * 3_600_000)
        : null,
    },
  });
}

export async function redeemInvite(code: string, user: User): Promise<string> {
  const invite = await prisma.invite.findUnique({
    where: { code },
    include: { conversation: { select: { id: true, name: true } } },
  });
  if (!invite) throw errors.notFound('That invite link is not valid.');
  if (invite.expiresAt && invite.expiresAt < new Date()) throw errors.badRequest('This invite expired.');

  const already = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: invite.conversationId, userId: user.id } },
  });
  if (already) return invite.conversationId;

  // Claim a use atomically. Checking `uses >= maxUses` and then incrementing in
  // separate statements is a TOCTOU race: N concurrent redeems all read the same
  // count and all pass. This conditional UPDATE ... WHERE uses < maxUses lets the
  // database arbitrate, so exactly `maxUses` claims can ever succeed.
  const claimed = await prisma.invite.updateMany({
    where: {
      id: invite.id,
      OR: [{ maxUses: null }, { uses: { lt: invite.maxUses ?? undefined } }],
    },
    data: { uses: { increment: 1 } },
  });
  if (claimed.count === 0) throw errors.badRequest('This invite has been used up.');

  await prisma.conversationMember.create({
    data: { conversationId: invite.conversationId, userId: user.id },
  });

  await systemMessage(invite.conversationId, `${user.displayName} joined via invite.`);
  const memberIds = await conversationMemberIds(invite.conversationId);
  await Promise.all([
    broadcastToUsers(memberIds, realtimeEvents.inboxUpdated, { conversationId: invite.conversationId }),
    broadcastToConversation(invite.conversationId, realtimeEvents.memberChanged, {
      conversationId: invite.conversationId,
    }),
  ]);

  return invite.conversationId;
}

/** Public groups: join instantly, or file a request when approval is required. */
export async function joinPublicConversation(
  conversationId: string,
  user: User,
  message?: string,
): Promise<{ joined: boolean }> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, isPublic: true, requiresApproval: true, name: true, type: true },
  });
  if (!conversation || conversation.type !== 'GROUP' || !conversation.isPublic) {
    throw errors.notFound('That group is not open to join.');
  }

  const existing = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: user.id } },
  });
  if (existing) return { joined: true };

  if (conversation.requiresApproval) {
    await prisma.joinRequest.upsert({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      create: { conversationId, userId: user.id, message: message?.trim() || null },
      update: { status: 'PENDING', message: message?.trim() || null },
    });

    const moderators = await prisma.conversationMember.findMany({
      where: { conversationId, role: { in: ['OWNER', 'ADMIN', 'MODERATOR'] } },
      select: { userId: true },
    });
    await notify({
      userIds: moderators.map((moderator) => moderator.userId),
      kind: 'JOIN_REQUEST',
      title: `${user.displayName} asked to join ${conversation.name ?? 'your group'}`,
      body: message?.trim() || null,
      actorId: user.id,
      conversationId,
    });
    return { joined: false };
  }

  await prisma.conversationMember.create({ data: { conversationId, userId: user.id } });
  await systemMessage(conversationId, `${user.displayName} joined.`);
  const memberIds = await conversationMemberIds(conversationId);
  await Promise.all([
    broadcastToUsers(memberIds, realtimeEvents.inboxUpdated, { conversationId }),
    broadcastToConversation(conversationId, realtimeEvents.memberChanged, { conversationId }),
  ]);
  return { joined: true };
}

export async function reviewJoinRequest(
  conversationId: string,
  actor: User,
  requestId: string,
  status: 'APPROVED' | 'REJECTED',
) {
  const membership = await requireMembership(conversationId, actor.id);
  if (!can.reviewJoinRequests(membership.role)) {
    throw errors.forbidden('You cannot review join requests.');
  }

  const request = await prisma.joinRequest.findFirst({
    where: { id: requestId, conversationId },
    include: { user: { select: { id: true, displayName: true } } },
  });
  if (!request) throw errors.notFound('Request not found.');

  await prisma.joinRequest.update({ where: { id: requestId }, data: { status } });

  if (status === 'APPROVED') {
    await prisma.conversationMember.upsert({
      where: { conversationId_userId: { conversationId, userId: request.userId } },
      create: { conversationId, userId: request.userId },
      update: {},
    });
    await systemMessage(conversationId, `${request.user.displayName} joined.`);
    const memberIds = await conversationMemberIds(conversationId);
    await Promise.all([
      broadcastToUsers(memberIds, realtimeEvents.inboxUpdated, { conversationId }),
      broadcastToConversation(conversationId, realtimeEvents.memberChanged, { conversationId }),
      notify({
        userIds: [request.userId],
        kind: 'GROUP_INVITE',
        title: `Your request to join ${membership.conversation.name ?? 'the group'} was approved`,
        actorId: actor.id,
        conversationId,
      }),
    ]);
  }
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
