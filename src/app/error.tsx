'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] render error', error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="panel w-full max-w-md rounded-[var(--radius-panel)] shadow-[var(--shadow-overlay)]">
        <EmptyState
          icon={<AlertTriangle />}
          title="That did not go to plan"
          description={
            error.message || 'An unexpected error interrupted the page. Trying again usually helps.'
          }
          action={
            <Button onClick={reset}>
              <RotateCcw />
              Try again
            </Button>
          }
        />
      </div>
    </main>
  );
}
