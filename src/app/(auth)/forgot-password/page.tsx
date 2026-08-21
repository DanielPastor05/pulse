import type { Metadata } from 'next';

import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';
import { getMessages } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.auth.resetYourPassword };
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
