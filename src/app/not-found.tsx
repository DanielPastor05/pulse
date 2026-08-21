import Link from 'next/link';
import { Compass } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { getMessages } from '@/i18n/server';

export default async function NotFound() {
  const t = await getMessages();

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="panel w-full max-w-md rounded-[var(--radius-panel)] shadow-[var(--shadow-overlay)]">
        <EmptyState
          icon={<Compass />}
          title={t.common.notFoundTitle}
          description={t.common.notFoundHint}
          action={
            <Button asChild>
              <Link href="/chat">{t.conversation.backToChats}</Link>
            </Button>
          }
        />
      </div>
    </main>
  );
}
