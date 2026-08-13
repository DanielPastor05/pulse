'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Mail, MailCheck } from 'lucide-react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { hardNavigate } from '@/lib/navigate';
import { signUpSchema, type SignUpInput } from '@/features/auth/validators';
import { AuthCard } from '@/features/auth/components/auth-card';
import { AuthDivider, OAuthButtons } from '@/features/auth/components/oauth-buttons';
import { PasswordInput, PasswordStrength } from '@/features/auth/components/password-input';
import { ResendConfirmation } from '@/features/auth/components/resend-confirmation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export function RegisterForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/onboarding';
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '' },
  });

  const password = watch('password');

  const onSubmit = handleSubmit(async (values) => {
    const supabase = getSupabaseBrowserClient();

    const callback = new URL('/auth/callback', window.location.origin);
    callback.searchParams.set('next', '/onboarding');

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { emailRedirectTo: callback.toString() },
    });

    if (error) {
      setError('email', { message: error.message });
      return;
    }

    // With email confirmation on, Supabase returns a user but no session.
    if (data.session) {
      hardNavigate(next);
      return;
    }

    setSentTo(values.email);
  });

  if (sentTo) {
    return (
      <AuthCard
        title="Check your inbox"
        description={`We sent a confirmation link to ${sentTo}. Open it to activate your account — the link expires in an hour.`}
        footer={
          <>
            Wrong address?{' '}
            <button
              type="button"
              onClick={() => setSentTo(null)}
              className="font-semibold text-[var(--accent)] hover:underline"
            >
              Use another one
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid place-items-center rounded-[var(--radius-card)] border border-[var(--hairline)] bg-[var(--surface-sunken)] py-10 text-[var(--accent)]">
            <MailCheck className="size-10" />
          </div>

          <ResendConfirmation email={sentTo} />

          <p className="text-center text-[12px] leading-relaxed text-[var(--text-3)]">
            Nothing after a minute? Check spam — and if it still has not arrived, the address may be
            unreachable from our mail provider.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      description="Two fields now, a profile in a moment, and you are in."
      footer={
        <>
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-semibold text-[var(--accent)] hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <OAuthButtons next="/onboarding" />
      <AuthDivider label="or sign up with email" />

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            icon={<Mail />}
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="Something only you know"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
          <PasswordStrength value={password ?? ''} />
        </Field>

        <Button type="submit" size="lg" block loading={isSubmitting} className="mt-2">
          Create account
          <ArrowRight />
        </Button>

        <p className="text-center text-[11px] leading-relaxed text-[var(--text-3)]">
          By continuing you agree to be nice to the people you talk to.
        </p>
      </form>
    </AuthCard>
  );
}
