import type { Metadata } from 'next';

import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';
import { getMessages } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.auth.resetTitle };
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
