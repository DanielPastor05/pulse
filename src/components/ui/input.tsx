'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

export const inputBase = [
  'w-full rounded-[var(--radius-field)] border border-[var(--hairline-strong)]',
  'bg-[var(--surface)] px-2.5 text-[13px] text-[var(--text-1)]',
  'placeholder:text-[var(--text-3)]',
  'outline-none transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out)]',
  'hover:border-[var(--text-3)]',
  // A 1px ring rather than a 2px glow: the field grows a sharper edge, it
  // doesn't light up.
  'focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]',
  'disabled:cursor-not-allowed disabled:bg-[var(--surface-sunken)] disabled:opacity-70',
  'aria-[invalid=true]:border-[var(--danger)] aria-[invalid=true]:shadow-[0_0_0_1px_var(--danger)]',
].join(' ');

export type InputProps = React.ComponentProps<'input'> & { icon?: React.ReactNode };

export function Input({ className, icon, ...props }: InputProps) {
  if (!icon) {
    return <input className={cn(inputBase, 'h-8.5', className)} {...props} />;
  }

  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-[var(--text-3)] [&_svg]:size-3.5"
        aria-hidden
      >
        {icon}
      </span>
      <input className={cn(inputBase, 'h-8.5 pl-8', className)} {...props} />
    </div>
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea className={cn(inputBase, 'resize-none py-2 leading-relaxed', className)} {...props} />;
}
