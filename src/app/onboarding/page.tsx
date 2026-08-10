import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/server/auth';
import { OnboardingFlow } from '@/features/profile/components/onboarding-flow';

export const metadata: Metadata = { title: 'Set up your profile' };
export const dynamic = 'force-dynamic';

/** Derives a legal, likely-free handle from whatever the provider gave us. */
function suggestUsername(seed: string): string {
  const base = seed
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 18);
  return base.length >= 3 ? base : `user${Math.floor(Math.random() * 9000 + 1000)}`;
}

export default async function OnboardingPage() {
  const authUser = await getAuthUser();
  if (!authUser) redirect('/login');

  const existing = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { onboardedAt: true, username: true, displayName: true, avatarUrl: true },
  });
  if (existing?.onboardedAt) redirect('/chat');

  const metadata = authUser.user_metadata ?? {};
  const fullName =
    (metadata.full_name as string | undefined) ??
    (metadata.name as string | undefined) ??
    existing?.displayName ??
    authUser.email?.split('@')[0] ??
    'New member';

  return (
    <main className="grid min-h-dvh place-items-center p-5">
      <OnboardingFlow
        suggestedUsername={existing?.username ?? suggestUsername(authUser.email?.split('@')[0] ?? fullName)}
        suggestedName={fullName}
        suggestedAvatar={existing?.avatarUrl ?? (metadata.avatar_url as string | undefined) ?? null}
      />
    </main>
  );
}
