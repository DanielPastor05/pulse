'use client';

import * as React from 'react';
import Link from 'next/link';

import { APP_NAME } from '@/lib/constants';

type AuthCardProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

/**
 * Glass slab with a neon rim. No entrance animation: this is the first thing
 * you see, and animating it delays the one action you came here to perform.
 */
export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <section className="panel neon-border rounded-[var(--radius-panel)] p-7 sm:p-9">
      <Link href="/" className="mb-8 inline-flex items-baseline gap-2 lg:hidden">
        <span className="font-[family-name:var(--font-display)] text-[17px] leading-none">
          {APP_NAME}
        </span>
        <span className="size-1 rounded-full bg-[var(--accent)]" aria-hidden />
      </Link>

      <div className="mb-7">
        <h1 className="font-[family-name:var(--font-display)] text-[1.9rem] font-bold leading-[1.15] tracking-tight glow-text">
          {title}
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-2)]">{description}</p>
      </div>

      {children}

      {footer ? <div className="mt-7 text-[13px] text-[var(--text-2)]">{footer}</div> : null}
    </section>
  );
}
