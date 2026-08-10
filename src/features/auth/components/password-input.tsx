'use client';

import * as React from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input, type InputProps } from '@/components/ui/input';

export function PasswordInput({ className, ...props }: InputProps) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        icon={<Lock />}
        className={cn('pr-11', className)}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className={cn(
          'absolute inset-y-0 right-1.5 my-auto grid size-8 place-items-center rounded-lg',
          'text-[var(--text-3)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-1)]',
        )}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

const RULES = [
  { test: (value: string) => value.length >= 8, label: '8+ characters' },
  { test: (value: string) => /[a-z]/.test(value) && /[A-Z]/.test(value), label: 'Upper & lower' },
  { test: (value: string) => /[0-9]/.test(value), label: 'A number' },
];

/** Live strength meter — reassurance while typing, not a gate. */
export function PasswordStrength({ value }: { value: string }) {
  const passed = RULES.filter((rule) => rule.test(value)).length;
  const tone = ['bg-[var(--danger)]', 'bg-[var(--warning)]', 'bg-[var(--success)]'];

  return (
    <div className="space-y-2 pt-1">
      <div className="flex gap-1.5" aria-hidden>
        {RULES.map((_, index) => (
          <span
            key={index}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-300',
              index < passed ? tone[Math.min(passed, 3) - 1] : 'bg-[var(--surface-sunken)]',
            )}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {RULES.map((rule) => (
          <li
            key={rule.label}
            className={cn(
              'text-[11px] transition-colors',
              rule.test(value) ? 'text-[var(--success)]' : 'text-[var(--text-3)]',
            )}
          >
            {rule.test(value) ? '✓' : '○'} {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
