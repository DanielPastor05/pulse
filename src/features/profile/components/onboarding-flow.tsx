'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, AtSign, PartyPopper, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { api, ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { hardNavigate } from '@/lib/navigate';
import { onboardingSchema, type OnboardingInput } from '@/features/profile/validators';
import { AccentPicker } from '@/features/profile/components/accent-picker';
import { AvatarPicker } from '@/features/profile/components/avatar-picker';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import type { CurrentUser } from '@/types/dto';
import { useT } from '@/i18n/provider';
import type { SoloTexto } from '@/i18n/en';

const STEPS = [
  { id: 'identity', title: 'claimHandle', blurb: 'claimHandleHint' },
  { id: 'look', title: 'makeItYours', blurb: 'makeItYoursHint' },
  { id: 'done', title: 'allSet', blurb: 'allSetHint' },
] as const satisfies ReadonlyArray<{
  id: string;
  title: SoloTexto<'auth'>;
  blurb: SoloTexto<'auth'>;
}>;

type Props = {
  suggestedUsername: string;
  suggestedName: string;
  suggestedAvatar: string | null;
};

export function OnboardingFlow({ suggestedUsername, suggestedName, suggestedAvatar }: Props) {
  const t = useT();
  const [step, setStep] = React.useState(0);
  const [direction, setDirection] = React.useState(1);

  const form = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    mode: 'onChange',
    defaultValues: {
      username: suggestedUsername,
      displayName: suggestedName,
      bio: '',
      avatarUrl: suggestedAvatar,
      accent: 'violet',
    },
  });

  const { register, handleSubmit, watch, setValue, trigger, setError, formState } = form;
  const values = watch();

  // Live-preview the accent while choosing it.
  React.useEffect(() => {
    document.documentElement.dataset.accent = values.accent;
  }, [values.accent]);

  const go = async (next: number) => {
    if (next > step) {
      const fields: Array<keyof OnboardingInput> =
        step === 0 ? ['username', 'displayName'] : ['bio'];
      const valid = await trigger(fields);
      if (!valid) return;
    }
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const onSubmit = handleSubmit(async (input) => {
    try {
      await api<CurrentUser>('/me/onboarding', { method: 'POST', body: input });
      toast.success(`Welcome, ${input.displayName}`);
      hardNavigate('/chat');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'conflict') {
        setError('username', { message: error.message });
        setDirection(-1);
        setStep(0);
        return;
      }
      toast.error(t.auth.saveFailed, {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  });

  const current = STEPS[step] ?? STEPS[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="panel w-full max-w-lg rounded-[var(--radius-panel)] p-8 shadow-[var(--shadow-overlay)]"
    >
      <div className="mb-7 flex items-center gap-2" aria-hidden>
        {STEPS.map((item, index) => (
          <span
            key={item.id}
            className={cn(
              'h-1 flex-1 rounded-full transition-all duration-400 ease-[var(--ease-out)]',
              index <= step ? 'bg-[var(--accent)]' : 'bg-[var(--surface-sunken)]',
            )}
          />
        ))}
      </div>

      <div className="mb-6 space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--accent)]">
          {t.auth.stepOf(step + 1, STEPS.length)}
        </p>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">{t.auth[current.title]}</h1>
        <p className="text-sm text-[var(--text-2)]">{t.auth[current.blurb]}</p>
      </div>

      <form onSubmit={onSubmit}>
        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={current.id}
              custom={direction}
              initial={{ opacity: 0, x: direction * 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -28 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-5"
            >
              {step === 0 ? (
                <>
                  <Field
                    label={t.settings.username}
                    htmlFor="username"
                    error={formState.errors.username?.message}
                    hint={t.auth.usernameHint}
                  >
                    <Input
                      id="username"
                      icon={<AtSign />}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder={t.auth.usernamePlaceholder}
                      aria-invalid={Boolean(formState.errors.username)}
                      {...register('username', {
                        setValueAs: (value: string) => value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                      })}
                    />
                  </Field>

                  <Field
                    label={t.settings.displayName}
                    htmlFor="displayName"
                    error={formState.errors.displayName?.message}
                  >
                    <Input
                      id="displayName"
                      placeholder={t.auth.displayNamePlaceholder}
                      aria-invalid={Boolean(formState.errors.displayName)}
                      {...register('displayName')}
                    />
                  </Field>
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <AvatarPicker
                    value={values.avatarUrl ?? null}
                    name={values.displayName || 'You'}
                    onChange={(url) => setValue('avatarUrl', url, { shouldDirty: true })}
                  />

                  <Field label={t.auth.accentColour}>
                    <AccentPicker
                      value={values.accent}
                      onChange={(accent) => setValue('accent', accent, { shouldDirty: true })}
                    />
                  </Field>

                  <Field
                    label={t.settings.bio}
                    htmlFor="bio"
                    hint={`${values.bio?.length ?? 0}/280`}
                    error={formState.errors.bio?.message}
                  >
                    <Textarea
                      id="bio"
                      rows={3}
                      maxLength={280}
                      placeholder={t.auth.bioPlaceholder}
                      {...register('bio')}
                    />
                  </Field>
                </>
              ) : null}

              {step === 2 ? (
                <div className="space-y-5">
                  <div className="panel relative overflow-hidden rounded-[var(--radius-card)] p-5">
                    <div className="bg-[var(--accent)] absolute inset-x-0 top-0 h-16 opacity-90" />
                    <div className="relative flex items-end gap-4 pt-6">
                      <AvatarPicker
                        value={values.avatarUrl ?? null}
                        name={values.displayName || 'You'}
                        onChange={(url) => setValue('avatarUrl', url)}
                        size="lg"
                      />
                    </div>
                    <div className="mt-4 space-y-1">
                      <p className="text-[15px] font-semibold">{values.displayName}</p>
                      <p className="text-[13px] text-[var(--text-2)]">@{values.username}</p>
                      {values.bio ? (
                        <p className="pt-1 text-[13px] leading-relaxed text-[var(--text-2)]">
                          {values.bio}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <p className="flex items-center gap-2 text-[13px] text-[var(--text-2)]">
                    <Sparkles className="size-4 text-[var(--accent)]" />
                    {t.auth.press} <kbd className="font-mono">⌘K</kbd> {t.auth.pressToJump}
                  </p>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => void go(step - 1)}
            className={cn(step === 0 && 'invisible')}
          >
            <ArrowLeft />
            {t.auth.back}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={() => void go(step + 1)}>
              {t.auth.continueStep}
              <ArrowRight />
            </Button>
          ) : (
            <Button type="submit" loading={formState.isSubmitting}>
              <PartyPopper />
              {t.auth.enterPulse}
            </Button>
          )}
        </div>
      </form>
    </motion.div>
  );
}
