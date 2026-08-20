'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Mail } from 'lucide-react';
import { toast } from 'sonner';

import { useT } from '@/i18n/provider';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { hardNavigate } from '@/lib/navigate';
import { signInSchema, type SignInInput } from '@/features/auth/validators';
import { AuthCard } from '@/features/auth/components/auth-card';
import { AuthDivider, OAuthButtons } from '@/features/auth/components/oauth-buttons';
import { PasswordInput } from '@/features/auth/components/password-input';
import { ResendConfirmation } from '@/features/auth/components/resend-confirmation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export function LoginForm() {
  const searchParams = useSearchParams();
  const t = useT();
  const next = searchParams.get('next') ?? '/chat';
  const [unconfirmed, setUnconfirmed] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword(values);

    if (error) {
      // A confirmed-email failure is not a wrong password, and telling people
      // it is sends them off resetting a password that was fine all along.
      if (/email not confirmed/i.test(error.message)) {
        setUnconfirmed(values.email);
        return;
      }

      const message =
        error.message === 'Invalid login credentials'
          ? t.auth.badCredentials
          : error.message;
      setError('password', { message });
      return;
    }

    toast.success(t.auth.welcomeBack);
    hardNavigate(next);
  });

  if (unconfirmed) {
    return (
      <AuthCard
        title={t.auth.confirmFirst}
        description={t.auth.confirmFirstHint(unconfirmed)}
        footer={
          <button
            type="button"
            onClick={() => setUnconfirmed(null)}
            className="font-semibold text-[var(--accent)] hover:underline"
          >
            {t.auth.backToSignIn}
          </button>
        }
      >
        <ResendConfirmation email={unconfirmed} />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t.auth.welcomeBack}
      description={t.auth.signInHint}
      footer={
        <>
          {t.auth.newHere}{' '}
          <Link
            href={`/register?next=${encodeURIComponent(next)}`}
            className="font-semibold text-[var(--accent)] hover:underline"
          >
            {t.auth.createAnAccount}
          </Link>
        </>
      }
    >
      <OAuthButtons next={next} />
      <AuthDivider />

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

        <Field
          label={t.auth.password}
          htmlFor="password"
          error={errors.password?.message}
          hint={
            <Link href="/forgot-password" className="hover:text-[var(--accent)]">
              {t.auth.forgotShort}
            </Link>
          }
        >
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </Field>

        <Button type="submit" size="lg" block loading={isSubmitting} className="mt-2">
          {t.auth.signIn}
          <ArrowRight />
        </Button>
      </form>
    </AuthCard>
  );
}
