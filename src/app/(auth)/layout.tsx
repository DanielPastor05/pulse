import Link from 'next/link';
import { Zap } from 'lucide-react';

import { APP_NAME } from '@/lib/constants';

/**
 * Split view: a quiet editorial column on the left, the form on the right.
 * The left panel carries one idea in the display face — no feature grid, no
 * icon tiles, no gradient. Three benefit cards is what a landing page does when
 * it has nothing to say.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
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
          <p className="label-caps mb-5 text-[var(--accent)]">Encrypted channel</p>
          <h1 className="text-[3.1rem] font-bold leading-[1.05] tracking-tight glow-text">
            Everything you said, exactly where you left it.
          </h1>
          <p className="mt-5 max-w-[34ch] text-[14px] leading-relaxed text-[var(--text-2)]">
            Direct messages, group spaces and public communities. Fast enough that you forget it is
            there.
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
