import { Suspense } from 'react';
import type { Metadata } from 'next';

import { LoginForm } from '@/features/auth/components/login-form';
import { AuthFormSkeleton } from '@/features/auth/components/auth-form-skeleton';
import { getMessages } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.auth.signIn };
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}
