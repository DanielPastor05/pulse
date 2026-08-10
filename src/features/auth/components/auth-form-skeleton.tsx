import { Skeleton } from '@/components/ui/skeleton';

export function AuthFormSkeleton() {
  return (
    <div className="panel space-y-6 rounded-[var(--radius-panel)] p-9 shadow-[var(--shadow-overlay)]">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-full" />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
      <Skeleton className="h-px w-full" />
      <div className="space-y-4">
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-12" />
      </div>
    </div>
  );
}
