'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n/provider';

const COOLDOWN_SECONDS = 60;

/**
 * Confirmation emails go missing: spam folders, provider throttling, a typo the
 * user cannot see from here. Without a way to ask for another one, an account
 * that never got the first email is simply stuck — it can neither sign in nor
 * register again, because the address is already taken.
 *
 * The cooldown is local only. Supabase enforces its own rate limit server-side;
 * this just stops people hammering the button and collecting error toasts.
 */
export function ResendConfirmation({ email }: { email: string }) {
  const t = useT();
  const [pending, setPending] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    setPending(true);
    const supabase = getSupabaseBrowserClient();

    const callback = new URL('/auth/callback', window.location.origin);
    callback.searchParams.set('next', '/onboarding');

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: callback.toString() },
    });

    setPending(false);

    if (error) {
      toast.error(t.auth.resendFailed, { description: error.message });
      return;
    }

    setCooldown(COOLDOWN_SECONDS);
    toast.success(t.auth.resent, { description: `Check ${email}.` });
  };

  return (
    <Button
      type="button"
      variant="secondary"
      block
      onClick={() => void resend()}
      loading={pending}
      disabled={cooldown > 0}
    >
      {cooldown > 0 ? `Resend in ${cooldown}s` : t.auth.resend}
    </Button>
  );
}
