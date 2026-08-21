'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { hardNavigate } from '@/lib/navigate';
import { resetPasswordSchema, type ResetPasswordInput } from '@/features/auth/validators';
import { AuthCard } from '@/features/auth/components/auth-card';
import { PasswordInput, PasswordStrength } from '@/features/auth/components/password-input';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { useT } from '@/i18n/provider';

export function ResetPasswordForm() {
  const t = useT();

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const password = watch('password');

  const onSubmit = handleSubmit(async (values) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: values.password });

    if (error) {
      setError('password', { message: error.message });
      return;
    }

    toast.success(t.auth.passwordUpdated);
    hardNavigate('/chat');
  });

  return (
    <AuthCard
      title={t.auth.resetTitle}
      description={t.auth.resetHint}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label={t.auth.newPassword} htmlFor="password" error={errors.password?.message}>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
          <PasswordStrength value={password ?? ''} />
        </Field>

        <Field label={t.auth.confirmPassword} htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
        </Field>

        <Button type="submit" size="lg" block loading={isSubmitting}>
          {t.auth.updatePassword}
        </Button>
      </form>
    </AuthCard>
  );
}
