'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

type EmptyStateProps = {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
};

/** Lit tile over a soft bloom, matching the pinned-banner treatment. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center text-center',
        compact ? 'gap-3 px-6 py-10' : 'gap-4 px-8 py-16',
        className,
      )}
    >
      <div className="relative">
        <div
          className="pointer-events-none absolute -inset-6 rounded-full blur-2xl"
          style={{ background: 'var(--accent-glow)', opacity: 0.35 }}
          aria-hidden
        />
        <span
          className={cn(
            'relative grid place-items-center rounded-[var(--radius-field)]',
            'bg-[var(--accent)] text-[var(--on-accent)] shadow-[0_0_15px_var(--accent-glow)]',
            compact ? 'size-11 [&_svg]:size-5' : 'size-14 [&_svg]:size-6',
          )}
          aria-hidden
        >
          {icon}
        </span>
      </div>

      <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
        <h3
          className={cn(
            'font-semibold tracking-tight text-[var(--text-1)]',
            compact ? 'text-[14px]' : 'text-[17px]',
          )}
        >
          {title}
        </h3>
        {description ? (
          <p
            className={cn(
              'mx-auto max-w-[38ch] leading-relaxed text-[var(--text-2)]',
              compact ? 'text-[12px]' : 'text-[13.5px]',
            )}
          >
            {description}
          </p>
        ) : null}
      </div>

      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
