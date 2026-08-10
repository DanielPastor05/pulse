import { Skeleton } from '@/components/ui/skeleton';

/** Shown while the layout resolves the session and profile on the server. */
export default function AppLoading() {
  return (
    <div className="flex h-dvh gap-3 p-2 sm:p-3">
      <div className="panel hidden w-[76px] shrink-0 flex-col items-center gap-2 rounded-[var(--radius-panel)] py-4 lg:flex">
        <Skeleton className="size-11 rounded-[var(--radius-card)]" />
        <Skeleton className="size-11 rounded-[var(--radius-card)]" />
        <div className="my-1 h-px w-8 bg-[var(--hairline)]" />
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="size-11 rounded-[var(--radius-card)]" />
        ))}
      </div>

      <div className="panel hidden w-[336px] shrink-0 rounded-[var(--radius-panel)] p-4 lg:block">
        <Skeleton className="mb-4 h-7 w-28" />
        <Skeleton className="mb-3 h-10 w-full rounded-[var(--radius-field)]" />
        <div className="space-y-2">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 p-1.5">
              <Skeleton className="size-11 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-2.5 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel h-full min-w-0 flex-1 rounded-[var(--radius-panel)]" />
    </div>
  );
}
