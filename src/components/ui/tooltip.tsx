'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '@/lib/utils';

export const TooltipProvider = TooltipPrimitive.Provider;

type TooltipProps = {
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  shortcut?: string;
  children: React.ReactNode;
  delay?: number;
};

export function Tooltip({ content, side = 'top', shortcut, children, delay = 260 }: TooltipProps) {
  return (
    <TooltipPrimitive.Root delayDuration={delay}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={7}
          className={cn(
            'z-50 flex items-center gap-2 rounded-lg px-2.5 py-1.5',
            'bg-[var(--text-1)] text-[12px] font-medium text-[var(--canvas)]',
            'shadow-[var(--shadow-raised)] select-none anim-pop',
          )}
        >
          {content}
          {shortcut ? (
            <kbd className="rounded border border-white/20 bg-white/10 px-1 font-mono text-[10px]">
              {shortcut}
            </kbd>
          ) : null}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
