/**
 * Cómo se entra a una conversación desde fuera.
 *
 * Invitaciones por enlace, grupos públicos y solicitudes de acceso. Es el único
 * de los tres módulos que atiende a alguien que **todavía no es miembro**, y
 * por eso sus comprobaciones no se parecen a las de los otros dos.
 */

import type { User } from '@prisma/client';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { realtimeEvents } from '@/lib/realtime';
import { randomId } from '@/lib/utils';
import { broadcastToConversation, broadcastToUsers } from '@/server/broadcast';
import { errors } from '@/server/errors';
import { conversationMemberIds, requireMembership } from '@/server/repositories/conversation.repository';
import { systemMessage } from '@/server/services/conversation-shared';
import { notify } from '@/server/services/notification.service';

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
