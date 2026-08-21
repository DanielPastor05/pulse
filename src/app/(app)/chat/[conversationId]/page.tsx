import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth';
import { ConversationView } from '@/features/messages/components/conversation-view';
import { MessageSkeleton } from '@/components/ui/skeleton';
import { getMessages } from '@/i18n/server';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ conversationId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { conversationId } = await params;
  const user = await requireUser();
  const t = await getMessages();

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: user.id } },
    include: {
      conversation: {
        select: {
          name: true,
          type: true,
          members: { where: { userId: { not: user.id } }, select: { user: { select: { displayName: true } } }, take: 1 },
        },
      },
    },
  });

  if (!membership) return { title: t.search.conversations };

  const { conversation } = membership;
  const title =
    conversation.name ?? conversation.members[0]?.user.displayName ?? t.conversation.directMessage;

  return { title };
}

export default async function ConversationPage({ params }: Props) {
  const { conversationId } = await params;
  const user = await requireUser();

  // Fail fast on the server so a stale link never renders a broken shell.
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: user.id } },
    select: { id: true },
  });
  if (!membership) notFound();

  return (
    <Suspense
      fallback={
        <div className="panel h-full rounded-[var(--radius-panel)]">
          <MessageSkeleton />
        </div>
      }
    >
      <ConversationView conversationId={conversationId} />
    </Suspense>
  );
}
