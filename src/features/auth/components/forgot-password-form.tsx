'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Mail, MailCheck } from 'lucide-react';
import { motion } from 'framer-motion';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/features/auth/validators';
import { AuthCard } from '@/features/auth/components/auth-card';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useT } from '@/i18n/provider';

export function ForgotPasswordForm() {
  const t = useT();
  const [sent, setSent] = React.useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    const supabase = getSupabaseBrowserClient();
    const redirectTo = new URL('/auth/callback', window.location.origin);
    redirectTo.searchParams.set('next', '/reset-password');

    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: redirectTo.toString(),
    });

    if (error) {
      setError('email', { message: error.message });
      return;
    }
    setSent(true);
  });

  if (sent) {
    return (
      <AuthCard
        title={t.auth.resetSent}
        description={t.auth.resetSentHint}
        footer={
          <Link href="/login" className="font-semibold text-[var(--accent)] hover:underline">
            {t.auth.backToSignIn}
          </Link>
        }
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="panel grid place-items-center rounded-[var(--radius-card)] py-10 text-[var(--accent)]"
        >
          <MailCheck className="size-10" />
        </motion.div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t.auth.forgotTitle}
      description={t.auth.forgotHint}
      footer={
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 font-semibold text-[var(--accent)] hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          {t.auth.backToSignIn}
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label={t.auth.email} htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t.auth.emailPlaceholder}
            icon={<Mail />}
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <Button type="submit" size="lg" block loading={isSubmitting}>
          {t.auth.sendResetLink}
        </Button>
      </form>
    </AuthCard>
  );
}
