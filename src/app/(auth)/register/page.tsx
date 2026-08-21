import { Suspense } from 'react';
import type { Metadata } from 'next';

import { RegisterForm } from '@/features/auth/components/register-form';
import { AuthFormSkeleton } from '@/features/auth/components/auth-form-skeleton';
import { getMessages } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.auth.createAnAccount };
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <RegisterForm />
    </Suspense>
  );
}
