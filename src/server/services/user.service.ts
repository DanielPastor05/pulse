import type { User } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { errors } from '@/server/errors';
import { publicUserSelect, toPublicUser } from '@/server/repositories/selectors';
import { notify } from '@/server/services/notification.service';
import type { UpdateProfileInput } from '@/features/profile/validators';
import type { CurrentUser, PublicUser, RelationshipDTO } from '@/types/dto';

export function toCurrentUser(user: User): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bannerColor: user.bannerColor,
    bio: user.bio,
    statusText: user.statusText,
    presence: user.presence,
    lastSeenAt: user.lastSeenAt.toISOString(),
    locale: user.locale,
    theme: user.theme,
    accent: user.accent,
    reducedMotion: user.reducedMotion,
    onboardedAt: user.onboardedAt?.toISOString() ?? null,
    notifications: {
      onMessage: user.notifyOnMessage,
      onMention: user.notifyOnMention,
      onReaction: user.notifyOnReaction,
      sounds: user.notifySounds,
      desktopPush: user.notifyDesktopPush,
    },
  };
}

export async function updateProfile(user: User, input: UpdateProfileInput): Promise<CurrentUser> {
  if (input.username && input.username !== user.username) {
    const taken = await prisma.user.findUnique({
      where: { username: input.username },
      select: { id: true },
    });
    if (taken) throw errors.conflict('That username is taken.');
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.username !== undefined ? { username: input.username } : {}),
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.statusText !== undefined ? { statusText: input.statusText } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      ...(input.accent !== undefined ? { accent: input.accent, bannerColor: input.accent } : {}),
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
      ...(input.reducedMotion !== undefined ? { reducedMotion: input.reducedMotion } : {}),
      ...(input.presence !== undefined ? { presence: input.presence, lastSeenAt: new Date() } : {}),
      ...(input.notifyOnMessage !== undefined ? { notifyOnMessage: input.notifyOnMessage } : {}),
      ...(input.notifyOnMention !== undefined ? { notifyOnMention: input.notifyOnMention } : {}),
      ...(input.notifyOnReaction !== undefined ? { notifyOnReaction: input.notifyOnReaction } : {}),
      ...(input.notifySounds !== undefined ? { notifySounds: input.notifySounds } : {}),
      ...(input.notifyDesktopPush !== undefined ? { notifyDesktopPush: input.notifyDesktopPush } : {}),
    },
  });

  return toCurrentUser(updated);
}

export async function searchUsers(viewerId: string, query: string): Promise<PublicUser[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const users = await prisma.user.findMany({
    where: {
      id: { not: viewerId },
      onboardedAt: { not: null },
      OR: [
        { username: { contains: term, mode: 'insensitive' } },
        { displayName: { contains: term, mode: 'insensitive' } },
      ],
      blocksMade: { none: { blockedId: viewerId } },
      blocksReceived: { none: { blockerId: viewerId } },
    },
    select: publicUserSelect,
    take: 20,
    orderBy: { username: 'asc' },
  });

  return users.map(toPublicUser);
}

// ---------------------------------------------------------------------------
// Friend requests
// ---------------------------------------------------------------------------

export async function listRelationships(userId: string): Promise<RelationshipDTO[]> {
  const rows = await prisma.relationship.findMany({
    where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
    include: {
      requester: { select: publicUserSelect },
      addressee: { select: publicUserSelect },
    },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    direction: row.requesterId === userId ? ('outgoing' as const) : ('incoming' as const),
    user: toPublicUser(row.requesterId === userId ? row.addressee : row.requester),
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function sendFriendRequest(requester: User, addresseeId: string) {
  if (requester.id === addresseeId) throw errors.badRequest('You are already your own friend.');

  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: requester.id, blockedId: addresseeId },
        { blockerId: addresseeId, blockedId: requester.id },
      ],
    },
  });
  if (blocked) throw errors.blocked('You cannot add this person.');

  // If they already asked us, accept instead of creating a mirrored request.
  const reverse = await prisma.relationship.findUnique({
    where: { requesterId_addresseeId: { requesterId: addresseeId, addresseeId: requester.id } },
  });
  if (reverse) {
    if (reverse.status !== 'ACCEPTED') {
      await prisma.relationship.update({ where: { id: reverse.id }, data: { status: 'ACCEPTED' } });
      await notify({
        userIds: [addresseeId],
        kind: 'FRIEND_ACCEPTED',
        title: `${requester.displayName} accepted your friend request`,
        actorId: requester.id,
      });
    }
    return;
  }

  await prisma.relationship.upsert({
    where: { requesterId_addresseeId: { requesterId: requester.id, addresseeId } },
    create: { requesterId: requester.id, addresseeId },
    update: { status: 'PENDING' },
  });

  await notify({
    userIds: [addresseeId],
    kind: 'FRIEND_REQUEST',
    title: `${requester.displayName} sent you a friend request`,
    actorId: requester.id,
  });
}

export async function respondToFriendRequest(
  user: User,
  relationshipId: string,
  accept: boolean,
) {
  const relationship = await prisma.relationship.findUnique({ where: { id: relationshipId } });
  if (!relationship) throw errors.notFound('Request not found.');
  if (relationship.addresseeId !== user.id) throw errors.forbidden('That request is not yours.');

  await prisma.relationship.update({
    where: { id: relationshipId },
    data: { status: accept ? 'ACCEPTED' : 'DECLINED' },
  });

  if (accept) {
    await notify({
      userIds: [relationship.requesterId],
      kind: 'FRIEND_ACCEPTED',
      title: `${user.displayName} accepted your friend request`,
      actorId: user.id,
    });
  }
}

export async function removeRelationship(user: User, relationshipId: string) {
  const relationship = await prisma.relationship.findUnique({ where: { id: relationshipId } });
  if (!relationship) return;
  if (relationship.requesterId !== user.id && relationship.addresseeId !== user.id) {
    throw errors.forbidden('That request is not yours.');
  }
  await prisma.relationship.delete({ where: { id: relationshipId } });
}

// ---------------------------------------------------------------------------
// Blocking
// ---------------------------------------------------------------------------

export async function setBlocked(user: User, targetId: string, blocked: boolean) {
  if (user.id === targetId) throw errors.badRequest('You cannot block yourself.');

  if (blocked) {
    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId: targetId } },
      create: { blockerId: user.id, blockedId: targetId },
      update: {},
    });
    await prisma.relationship.deleteMany({
      where: {
        OR: [
          { requesterId: user.id, addresseeId: targetId },
          { requesterId: targetId, addresseeId: user.id },
        ],
      },
    });
  } else {
    await prisma.block
      .delete({ where: { blockerId_blockedId: { blockerId: user.id, blockedId: targetId } } })
      .catch(() => undefined);
  }
}

export async function listBlocked(userId: string): Promise<PublicUser[]> {
  const blocks = await prisma.block.findMany({
    where: { blockerId: userId },
    include: { blocked: { select: publicUserSelect } },
    orderBy: { createdAt: 'desc' },
  });
  return blocks.map((block) => toPublicUser(block.blocked));
}

export async function touchPresence(userId: string, presence: User['presence']) {
  await prisma.user.update({
    where: { id: userId },
    data: { presence, lastSeenAt: new Date() },
  });
}
