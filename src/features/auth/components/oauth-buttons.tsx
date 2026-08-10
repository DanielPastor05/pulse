'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.92l-3.88-3c-1.08.72-2.45 1.16-4.06 1.16-3.12 0-5.77-2.11-6.71-4.96H1.28v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.28a12 12 0 0 0 0 10.74l4.01-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.63l4.01 3.09C6.23 6.87 8.88 4.75 12 4.75Z"
      />
    </svg>
  );
}

function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
      <path d="M12 .5a12 12 0 0 0-3.79 23.4c.6.1.82-.26.82-.58v-2.2c-3.34.72-4.04-1.42-4.04-1.42-.55-1.4-1.34-1.77-1.34-1.77-1.1-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.96 0-1.31.47-2.39 1.24-3.23-.12-.3-.54-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.4 11.4 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.92 1.24 3.23 0 4.63-2.8 5.65-5.48 5.95.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.58A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

const PROVIDERS = [
  { id: 'google', label: 'Google', mark: <GoogleMark /> },
  { id: 'github', label: 'GitHub', mark: <GithubMark /> },
] as const;

export function OAuthButtons({ next }: { next?: string }) {
  const [pending, setPending] = React.useState<string | null>(null);

  const signIn = async (provider: 'google' | 'github') => {
    setPending(provider);
    const supabase = getSupabaseBrowserClient();

    const callback = new URL('/auth/callback', window.location.origin);
    if (next) callback.searchParams.set('next', next);

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callback.toString() },
    });

    if (error) {
      setPending(null);
      toast.error('Could not start sign-in', { description: error.message });
    }
  };

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {PROVIDERS.map((provider) => (
        <Button
          key={provider.id}
          type="button"
          variant="secondary"
          size="lg"
          loading={pending === provider.id}
          disabled={pending !== null}
          onClick={() => signIn(provider.id)}
        >
          {pending === provider.id ? null : provider.mark}
          {provider.label}
        </Button>
      ))}
    </div>
  );
}

export function AuthDivider({ label = 'or continue with email' }: { label?: string }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-[var(--hairline)]" />
      <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-3)]">
        {label}
      </span>
      <span className="h-px flex-1 bg-[var(--hairline)]" />
    </div>
  );
}
