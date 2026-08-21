import Link from 'next/link';
import { Zap } from 'lucide-react';

import { APP_NAME } from '@/lib/constants';
import { getMessages } from '@/i18n/server';

/**
 * Split view: a quiet editorial column on the left, the form on the right.
 * The left panel carries one idea in the display face — no feature grid, no
 * icon tiles, no gradient. Three benefit cards is what a landing page does when
 * it has nothing to say.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getMessages();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex xl:p-14">
        <Link href="/" className="inline-flex w-fit items-center gap-3">
          <span className="grid size-9 place-items-center rounded-[var(--radius-field)] bg-[var(--accent)] text-[var(--on-accent)] shadow-[0_0_15px_var(--accent-glow)]">
            <Zap className="size-4" />
          </span>
          <span className="text-[17px] font-bold uppercase tracking-widest glow-text">
            {APP_NAME}
          </span>
        </Link>

        <div className="max-w-[26rem]">
          <p className="label-caps mb-5 text-[var(--accent)]">{t.auth.encryptedChannel}</p>
          <h1 className="text-[3.1rem] font-bold leading-[1.05] tracking-tight glow-text">
            {t.auth.tagline}
          </h1>
          <p className="mt-5 max-w-[34ch] text-[14px] leading-relaxed text-[var(--text-2)]">
            {t.auth.taglineHint}
          </p>
        </div>

        <p className="text-[12px] text-[var(--text-3)]">
          © {new Date().getFullYear()} {APP_NAME}
        </p>
      </aside>

      <main className="flex min-h-dvh items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[24rem]">{children}</div>
      </main>
    </div>
  );
}
