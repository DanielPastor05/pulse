import type * as React from 'react';

import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('skeleton rounded-lg', className)} aria-hidden {...props} />;
}

/** Placeholder that mirrors the real bubble rhythm instead of grey blocks. */
export function MessageSkeleton({ count = 6 }: { count?: number }) {
  const widths = ['62%', '38%', '78%', '46%', '55%', '70%', '34%', '58%'];

  return (
    <div className="space-y-5 px-4 py-6" aria-hidden>
      {Array.from({ length: count }).map((_, index) => {
        const mine = index % 3 === 2;
        return (
          <div
            key={index}
            className={cn('flex items-end gap-2.5', mine && 'flex-row-reverse')}
            style={{ opacity: 1 - index * 0.06 }}
          >
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton
              className="h-9 rounded-[var(--radius-card)]"
              style={{ width: widths[index % widths.length] }}
            />
          </div>
        );
      })}
    </div>
  );
}

export function ConversationSkeleton({ count = 7 }: { count?: number }) {
  return (
    <div className="space-y-1.5 px-2" aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-[var(--radius-card)] p-2.5">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/2 rounded" />
            <Skeleton className="h-2.5 w-3/4 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
