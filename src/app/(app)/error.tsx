'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useT } from '@/i18n/provider';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  useEffect(() => {
    console.error('[app] section error', error);
  }, [error]);

  return (
    <div className="panel grid h-full place-items-center rounded-[var(--radius-panel)]">
      <EmptyState
        icon={<AlertTriangle />}
        title={t.common.panelErrorTitle}
        description={error.message || t.common.panelErrorHint}
        action={
          <Button onClick={reset}>
            <RotateCcw />
            {t.common.retry}
          </Button>
        }
      />
    </div>
  );
}
