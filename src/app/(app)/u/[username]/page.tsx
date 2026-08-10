import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth';
import { publicUserSelect, toPublicUser } from '@/server/repositories/selectors';
import { ProfileCard } from '@/features/profile/components/profile-card';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const user = await prisma.user.findUnique({
    where: { username },
    select: { displayName: true },
  });
  return { title: user ? `${user.displayName} (@${username})` : 'Profile' };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const viewer = await requireUser();

  const user = await prisma.user.findUnique({ where: { username }, select: publicUserSelect });
  if (!user) notFound();

  const [relationship, block] = await Promise.all([
    prisma.relationship.findFirst({
      where: {
        OR: [
          { requesterId: viewer.id, addresseeId: user.id },
          { requesterId: user.id, addresseeId: viewer.id },
        ],
      },
    }),
    prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: user.id } },
    }),
  ]);

  return (
    <ProfileCard
      user={toPublicUser(user)}
      isMe={viewer.id === user.id}
      relationship={
        relationship
          ? {
              id: relationship.id,
              status: relationship.status,
              direction: relationship.requesterId === viewer.id ? 'outgoing' : 'incoming',
            }
          : null
      }
      blockedByMe={Boolean(block)}
    />
  );
}
