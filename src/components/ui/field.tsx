'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { AnimatePresence, motion } from 'framer-motion';

import { cn } from '@/lib/utils';

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn('text-[13px] font-medium text-[var(--text-2)]', className)}
      {...props}
    />
  );
}

type FieldProps = {
  label?: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
};

/** Label + control + animated validation message, so forms stay consistent. */
export function Field({ label, htmlFor, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor={htmlFor}>{label}</Label>
          {hint ? <span className="text-[11px] text-[var(--text-3)]">{hint}</span> : null}
        </div>
      ) : null}
      {children}
      <AnimatePresence initial={false}>
        {error ? (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="text-[12px] font-medium text-[var(--danger)]"
          >
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
