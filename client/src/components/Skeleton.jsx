export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-gray-200 dark:bg-fide-700 rounded ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-5 shadow-sm space-y-3">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-4 space-y-3">
      <div className="flex gap-4 pb-2 border-b dark:border-fide-700">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StandingsSkeleton() {
  return (
    <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex gap-4 pb-2 border-b dark:border-fide-700">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-4 items-center">
            <Skeleton className="h-5 w-10" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RoundCardSkeleton() {
  return (
    <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl p-4 space-y-3">
      <div className="flex justify-between items-center">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 items-center">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

export function PlayersSkeleton() {
  return (
    <div className="bg-white dark:bg-fide-800 border dark:border-fide-700 rounded-xl overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex gap-4 pb-2 border-b dark:border-fide-700">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-4 items-center">
            <Skeleton className="h-5 w-8" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
