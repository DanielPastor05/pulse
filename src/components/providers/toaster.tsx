'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      position="bottom-right"
      offset={20}
      gap={10}
      visibleToasts={4}
      toastOptions={{
        classNames: {
          toast:
            'group !rounded-[var(--radius-card)] !border-[var(--hairline)] !bg-[var(--surface-solid)] !text-[var(--text-1)] !shadow-[var(--shadow-overlay)]',
          title: '!text-[13px] !font-semibold',
          description: '!text-[12px] !text-[var(--text-2)]',
          actionButton:
            '!rounded-[var(--radius-control)] !bg-[var(--accent)] !text-[var(--on-accent)] !text-[12px]',
          cancelButton:
            '!rounded-[var(--radius-control)] !bg-[var(--surface-sunken)] !text-[var(--text-2)]',
          error: '!text-[var(--danger)]',
          success: '!text-[var(--success)]',
        },
      }}
    />
  );
}
