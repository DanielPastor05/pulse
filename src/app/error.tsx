'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useT } from '@/i18n/provider';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  useEffect(() => {
    console.error('[app] render error', error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="panel w-full max-w-md rounded-[var(--radius-panel)] shadow-[var(--shadow-overlay)]">
        <EmptyState
          icon={<AlertTriangle />}
          title={t.common.errorTitle}
          description={
            error.message || t.common.errorHint
          }
          action={
            <Button onClick={reset}>
              <RotateCcw />
              {t.common.retry}
            </Button>
          }
        />
      </div>
    </main>
  );
}
