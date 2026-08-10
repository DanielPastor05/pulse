'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] section error', error);
  }, [error]);

  return (
    <div className="panel grid h-full place-items-center rounded-[var(--radius-panel)]">
      <EmptyState
        icon={<AlertTriangle />}
        title="This panel hit a snag"
        description={error.message || 'Retrying usually clears it. The rest of the app is fine.'}
        action={
          <Button onClick={reset}>
            <RotateCcw />
            Try again
          </Button>
        }
      />
    </div>
  );
}
