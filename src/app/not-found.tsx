import Link from 'next/link';
import { Compass } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="panel w-full max-w-md rounded-[var(--radius-panel)] shadow-[var(--shadow-overlay)]">
        <EmptyState
          icon={<Compass />}
          title="Nothing lives at this address"
          description="The page you were looking for moved, or never existed in the first place."
          action={
            <Button asChild>
              <Link href="/chat">Back to your chats</Link>
            </Button>
          }
        />
      </div>
    </main>
  );
}
