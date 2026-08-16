import { prisma } from '@/lib/prisma';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { errors } from '@/server/errors';
import { describeError, log } from '@/server/logger';
import type { SessionUser } from '@/server/auth';

/**
 * Todo lo que es tuyo, en un JSON.
 *
 * Deliberadamente **no** incluye los mensajes de los demás, aunque estén en tus
 * conversaciones: son de quien los escribió, y una exportación no es una excusa
 * para llevarte la conversación de otra persona. Lo que sí va es todo lo que
 * has producido tú, más el contexto mínimo para entenderlo — de qué sala era un
 * mensaje, no quién más estaba en ella.
 */
export async function exportAccount(user: SessionUser) {
  const [messages, reactions, stars, pollVotes, memberships, relationships] = await Promise.all([
    prisma.message.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        conversationId: true,
        content: true,
        kind: true,
        createdAt: true,
        editedAt: true,
        deletedAt: true,
        attachments: { select: { name: true, url: true, kind: true, size: true } },
      },
    }),
    prisma.reaction.findMany({
      where: { userId: user.id },
      select: { messageId: true, emoji: true, createdAt: true },
    }),
    prisma.starredMessage.findMany({
      where: { userId: user.id },
      select: { messageId: true, createdAt: true },
    }),
    prisma.pollVote.findMany({
      where: { userId: user.id },
      select: { optionId: true, createdAt: true },
    }),
    prisma.conversationMember.findMany({
      where: { userId: user.id },
      select: {
        conversationId: true,
        role: true,
        joinedAt: true,
        conversation: { select: { name: true, type: true } },
      },
    }),
    prisma.relationship.findMany({
      where: { OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
      select: { requesterId: true, addresseeId: true, status: true, createdAt: true },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      statusText: user.statusText,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    },
    messages,
    reactions,
    stars,
    pollVotes,
    memberships,
    relationships,
    // Se dice lo que falta, para que nadie crea que tiene más de lo que tiene.
    notIncluded:
      'Messages written by other people, even in conversations you belong to. They are theirs.',
  };
}

/**
 * Grupos que se quedarían sin dueño.
 *
 * `ownerId` es `onDelete: SetNull`, así que borrar la cuenta no rompe nada a
 * nivel de datos — pero deja una sala con gente dentro y nadie que pueda
 * administrarla, expulsar a alguien o cerrarla. La transferencia de propiedad ya
 * existe, así que la respuesta correcta es negarse y decir cuáles, no dejar
 * huérfanos en silencio.
 *
 * Un grupo donde ya no queda nadie más no cuenta: se va con la cuenta y no deja
 * a nadie atrapado.
 */
export async function orphanedGroups(userId: string) {
  const owned = await prisma.conversation.findMany({
    where: { ownerId: userId, type: 'GROUP' },
    select: { id: true, name: true, _count: { select: { members: true } } },
  });
  return owned
    .filter((conversation) => conversation._count.members > 1)
    .map((conversation) => ({
      id: conversation.id,
      name: conversation.name,
      memberCount: conversation._count.members,
    }));
}

/**
 * Borra la cuenta de verdad.
 *
 * El borrado se pide a Supabase Auth con la clave de servicio, no a Postgres:
 * el trigger `on_auth_user_deleted` de `prisma/sql/security.sql` se encarga de
 * la fila de `public.users`, y las cascadas del esquema del resto. Hacerlo al
 * revés dejaría una cuenta de autenticación viva sin perfil, que es peor que no
 * borrar nada — podría iniciar sesión y quedarse a medias en el onboarding.
 */
export async function deleteAccount(user: SessionUser, confirmation: string) {
  if (confirmation !== user.username) {
    throw errors.badRequest('Type your username exactly to confirm.');
  }

  const blocked = await orphanedGroups(user.id);
  if (blocked.length > 0) {
    throw errors.conflict(
      'Transfer or leave the groups you own first, so nobody is left without an owner.',
      { groups: blocked },
    );
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    log.error('account.delete_failed', { userId: user.id, ...describeError(error) });
    throw errors.badRequest('Could not delete the account. Try again in a moment.');
  }

  log.info('account.deleted', { userId: user.id });
}
