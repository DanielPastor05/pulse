'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Mail } from 'lucide-react';
import { toast } from 'sonner';

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
          ? 'That email and password combination is not right.'
          : error.message;
      setError('password', { message });
      return;
    }

    toast.success('Welcome back');
    hardNavigate(next);
  });

  if (unconfirmed) {
    return (
      <AuthCard
        title="Confirm your email first"
        description={`${unconfirmed} exists but has never been confirmed. Open the link we sent, or ask for a new one.`}
        footer={
          <button
            type="button"
            onClick={() => setUnconfirmed(null)}
            className="font-semibold text-[var(--accent)] hover:underline"
          >
            Back to sign in
          </button>
        }
      >
        <ResendConfirmation email={unconfirmed} />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to pick up every conversation exactly where you left it."
      footer={
        <>
          New here?{' '}
          <Link
            href={`/register?next=${encodeURIComponent(next)}`}
            className="font-semibold text-[var(--accent)] hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <OAuthButtons next={next} />
      <AuthDivider />

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

        <Field
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          hint={
            <Link href="/forgot-password" className="hover:text-[var(--accent)]">
              Forgot?
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
          Sign in
          <ArrowRight />
        </Button>
      </form>
    </AuthCard>
  );
}
