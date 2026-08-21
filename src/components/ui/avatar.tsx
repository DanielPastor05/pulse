'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import type { Presence } from '@prisma/client';

import { cn, hashHue, initials } from '@/lib/utils';
import { useT } from '@/i18n/provider';
import type { Messages } from '@/i18n/en';

const SIZES = {
  xs: 'size-6 rounded-md text-[9px]',
  sm: 'size-8 rounded-lg text-[11px]',
  md: 'size-10 rounded-[var(--radius-field)] text-[12px]',
  lg: 'size-12 rounded-[var(--radius-card)] text-[15px]',
  xl: 'size-20 rounded-[var(--radius-panel)] text-2xl',
} as const;

const DOT_SIZES = {
  xs: 'size-2 -right-0.5 -bottom-0.5',
  sm: 'size-2.5 -right-0.5 -bottom-0.5',
  md: 'size-3.5 -right-1 -bottom-1',
  lg: 'size-4 -right-1 -bottom-1',
  xl: 'size-5 right-1 bottom-1',
} as const;

export const PRESENCE_COLOR: Record<Presence, string> = {
  ONLINE: 'bg-[var(--accent-mint)] shadow-[0_0_8px_var(--accent-mint)]',
  IDLE: 'bg-[var(--warning)]',
  DND: 'bg-[var(--danger)]',
  OFFLINE: 'bg-transparent border-2 border-[var(--hairline-strong)]',
};

export const PRESENCE_LABEL = {
  ONLINE: 'online',
  IDLE: 'away',
  DND: 'doNotDisturb',
  OFFLINE: 'offline',
} as const satisfies Record<Presence, keyof Messages['common']>;

export type AvatarProps = {
  src?: string | null;
  name: string;
  size?: keyof typeof SIZES;
  presence?: Presence | null;
  className?: string;
  ring?: boolean;
};

/**
 * Squared-off, not circular. The reference treats avatars as tiles in the same
 * grammar as the icon buttons, which is what keeps the layout feeling machined
 * rather than social.
 */
export function Avatar({ src, name, size = 'md', presence, className, ring }: AvatarProps) {
  const t = useT();
  const hue = hashHue(name);

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <AvatarPrimitive.Root
        className={cn(
          'inline-flex select-none items-center justify-center overflow-hidden',
          'border border-[var(--hairline)] font-semibold text-white',
          ring && 'border-[var(--accent-line)] shadow-[0_0_15px_var(--accent-glow)]',
          SIZES[size],
        )}
        style={{ backgroundColor: `hsl(${hue} 45% 26%)` }}
      >
        {src ? (
          <AvatarPrimitive.Image src={src} alt="" className="size-full object-cover" loading="lazy" />
        ) : null}
        <AvatarPrimitive.Fallback delayMs={src ? 300 : 0} className="leading-none">
          {initials(name)}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>

      {presence ? (
        <span
          className={cn(
            'absolute rounded-full border-2 border-[var(--canvas)]',
            DOT_SIZES[size],
            PRESENCE_COLOR[presence],
          )}
          title={t.common[PRESENCE_LABEL[presence]]}
        >
          <span className="sr-only">{t.common[PRESENCE_LABEL[presence]]}</span>
        </span>
      ) : null}
    </span>
  );
}
