import { redirect } from 'next/navigation';

import { getAuthUser, getSessionUser } from '@/server/auth';
import { toCurrentUser } from '@/server/services/user.service';
import { SessionProvider } from '@/components/providers/session-provider';
import { AppShell } from '@/components/layout/app-shell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Two different failures that must not be conflated:
  //   no Supabase session          -> sign in
  //   session but no profile row   -> finish onboarding
  // Sending the second case to /login bounced against the middleware rule that
  // redirects signed-in users away from /login, producing a redirect loop.
  const authUser = await getAuthUser();
  if (!authUser) redirect('/login');

  const user = await getSessionUser();
  if (!user?.onboardedAt) redirect('/onboarding');

  return (
    <SessionProvider initialUser={toCurrentUser(user)}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
