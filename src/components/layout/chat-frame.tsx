'use client';

import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { ConversationSidebar } from '@/features/conversations/components/conversation-sidebar';
import { UserWidget } from '@/components/layout/user-widget';

/**
 * Two panes on phones, three columns from lg up. The left column stacks the
 * channel list over the user widget, matching the reference.
 */
export function ChatFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inThread = pathname !== '/chat';

  return (
    <>
      <aside
        className={cn(
          'flex h-full w-full shrink-0 flex-col gap-4 lg:w-64 lg:gap-6',
          inThread && 'hidden lg:flex',
        )}
      >
        <ConversationSidebar />
        <div className="hidden lg:block">
          <UserWidget />
        </div>
      </aside>

      <section className={cn('h-full min-w-0 flex-1', !inThread && 'hidden lg:block')}>
        {children}
      </section>
    </>
  );
}
