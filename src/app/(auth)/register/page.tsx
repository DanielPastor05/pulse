import { Suspense } from 'react';
import type { Metadata } from 'next';

import { RegisterForm } from '@/features/auth/components/register-form';
import { AuthFormSkeleton } from '@/features/auth/components/auth-form-skeleton';

export const metadata: Metadata = { title: 'Create an account' };

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <RegisterForm />
    </Suspense>
  );
}
