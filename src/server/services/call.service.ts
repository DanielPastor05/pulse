import type { User } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { realtimeEvents, type CallInvitePayload, type CallMode } from '@/lib/realtime';
import { broadcastToUsers } from '@/server/broadcast';
import { errors } from '@/server/errors';
import {
  conversationMemberIds,
  requireMembership,
} from '@/server/repositories/conversation.repository';
import { notify } from '@/server/services/notification.service';

/**
 * Rings everyone else in a conversation.
 *
 * The signalling itself never comes through here — offers, answers and ICE
 * candidates go peer to peer over the conversation's Realtime channel, so the
 * server is not in the path of anything latency-sensitive.
 *
 * The invite is the exception, and has to be: RLS lets a member publish to the
 * conversation topic but not to somebody else's `user:<id>` topic, and an
 * invite that only reached people already looking at that chat would not be a
 * ringing phone. Only the service role can write there.
 */
export async function ringConversation(
  conversationId: string,
  caller: User,
  input: { callId: string; mode: CallMode },
): Promise<void> {
  await requireMembership(conversationId, caller.id);

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { name: true, type: true },
  });
  if (!conversation) throw errors.notFound('That conversation no longer exists.');

  const memberIds = await conversationMemberIds(conversationId);
  const others = memberIds.filter((id) => id !== caller.id);
  if (others.length === 0) throw errors.badRequest('There is nobody here to call.');

  const payload: CallInvitePayload & { conversationName: string | null } = {
    callId: input.callId,
    conversationId,
    conversationName: conversation.name,
    mode: input.mode,
    from: { id: caller.id, displayName: caller.displayName, avatarUrl: caller.avatarUrl },
  };

  await broadcastToUsers(others, realtimeEvents.callInvite, payload);

  // Also as a notification, so a closed tab still rings through web push. The
  // kind is MESSAGE because a call is not something to be silenced by the
  // reaction toggle.
  await notify({
    userIds: others,
    kind: 'MESSAGE',
    title: `${caller.displayName} is calling`,
    body: input.mode === 'video' ? 'Video call' : 'Voice call',
    actorId: caller.id,
    conversationId,
  });
}

/** Tells the caller that this person is not picking up. */
export async function rejectCall(
  conversationId: string,
  user: User,
  callId: string,
): Promise<void> {
  await requireMembership(conversationId, user.id);

  const memberIds = await conversationMemberIds(conversationId);
  await broadcastToUsers(
    memberIds.filter((id) => id !== user.id),
    realtimeEvents.callReject,
    { callId, userId: user.id },
  );
}
