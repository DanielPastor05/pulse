import { Suspense } from 'react';

import { ChatFrame } from '@/components/layout/chat-frame';
import { ConversationSkeleton } from '@/components/ui/skeleton';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="panel h-full w-full rounded-[var(--radius-panel)] p-4 lg:w-[336px]">
          <ConversationSkeleton />
        </div>
      }
    >
      <ChatFrame>{children}</ChatFrame>
    </Suspense>
  );
}
