'use client';

import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as SeparatorPrimitive from '@radix-ui/react-separator';

import { cn } from '@/lib/utils';

// --- Badge ------------------------------------------------------------------

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: React.ComponentProps<'span'> & { tone?: 'neutral' | 'accent' | 'success' | 'danger' }) {
  const tones = {
    neutral: 'border-[var(--hairline)] bg-[var(--surface-sunken)] text-[var(--text-2)]',
    accent: 'border-[var(--accent-line)] bg-[var(--accent-quiet)] text-[var(--accent)] [text-shadow:0_0_10px_var(--accent-glow)]',
    success: 'border-[var(--success)]/35 text-[var(--success)]',
    danger: 'border-[var(--danger)]/35 text-[var(--danger)]',
  } as const;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
        'text-[10px] font-bold uppercase tracking-widest leading-[16px]',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/**
 * Unread count. Deliberately not animated: this appears dozens of times a day
 * per row, and a spring on each one turns the sidebar into a fidget toy.
 */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      data-numeric
      className={cn(
        'grid min-w-[18px] place-items-center rounded-full bg-[var(--accent)] px-1',
        'text-[10.5px] font-bold leading-[17px] text-[var(--on-accent)]',
        'shadow-[0_0_10px_var(--accent-glow)]',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

// --- Switch -----------------------------------------------------------------

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full',
        'border border-transparent transition-colors duration-150 ease-[var(--ease-out)]',
        'data-[state=unchecked]:border-[var(--hairline-strong)] data-[state=unchecked]:bg-[var(--surface-sunken)]',
        'data-[state=checked]:bg-[var(--accent)]',
        'disabled:cursor-not-allowed disabled:opacity-45',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block size-3.5 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.2)]',
          'transition-transform duration-150 ease-[var(--ease-out)]',
          'translate-x-0.5 data-[state=checked]:translate-x-[15px]',
        )}
      />
    </SwitchPrimitive.Root>
  );
}

// --- Tabs -------------------------------------------------------------------

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex items-center gap-4 border-b border-[var(--hairline)]',
        className,
      )}
      {...props}
    />
  );
}

/** Underline tabs rather than a pill track — quieter, and it reads as navigation. */
export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'relative -mb-px border-b-2 border-transparent px-0.5 pb-2 pt-1',
        'text-[13px] font-medium text-[var(--text-3)]',
        'transition-colors duration-150 ease-[var(--ease-out)]',
        'hover:text-[var(--text-1)]',
        'data-[state=active]:border-[var(--accent)] data-[state=active]:text-[var(--accent)] data-[state=active]:[text-shadow:0_0_10px_var(--accent-glow)]',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('outline-none', className)} {...props} />;
}

// --- Separator --------------------------------------------------------------

export function Separator({
  className,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      className={cn(
        'shrink-0 bg-[var(--hairline)]',
        'data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full',
        'data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
        className,
      )}
      {...props}
    />
  );
}

// --- Keyboard hint ----------------------------------------------------------

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] px-1',
        'border border-[var(--hairline)] bg-[var(--surface-sunken)]',
        'font-mono text-[10.5px] font-medium text-[var(--text-3)]',
      )}
    >
      {children}
    </kbd>
  );
}
