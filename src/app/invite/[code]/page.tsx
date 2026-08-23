import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { getAuthUser, getSessionUser } from '@/server/auth';
import { InviteCard } from '@/features/conversations/components/invite-card';
import { getMessages } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.conversation.invited };
}
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ code: string }> };

export default async function InvitePage({ params }: Props) {
  const { code } = await params;
  const t = await getMessages();

  const authUser = await getAuthUser();
  if (!authUser) redirect(`/login?next=${encodeURIComponent(`/invite/${code}`)}`);

  const user = await getSessionUser();
  if (!user?.onboardedAt) redirect('/onboarding');

  const invite = await prisma.invite.findUnique({
    where: { code },
    include: {
      createdBy: { select: { displayName: true } },
      conversation: {
        select: {
          id: true,
          name: true,
          description: true,
          avatarUrl: true,
          accent: true,
          _count: { select: { members: true } },
          members: { where: { userId: user.id }, select: { id: true } },
        },
      },
    },
  });

  if (invite?.conversation.members.length) redirect(`/chat/${invite.conversation.id}`);

  const expired = Boolean(
    invite &&
      ((invite.expiresAt !== null && invite.expiresAt < new Date()) ||
        (invite.maxUses !== null && invite.uses >= invite.maxUses)),
  );

  return (
    <main className="grid min-h-dvh place-items-center p-5">
      <InviteCard
        code={code}
        expired={expired}
        invite={
          invite
            ? {
                invitedBy: invite.createdBy.displayName,
                name: invite.conversation.name ?? t.settings.untitledGroup,
                description: invite.conversation.description,
                avatarUrl: invite.conversation.avatarUrl,
                accent: invite.conversation.accent,
                memberCount: invite.conversation._count.members,
              }
            : null
        }
      />
    </main>
  );
}
