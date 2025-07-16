import { Skeleton } from "~/app/components/ui/skeleton";

export default function DiaryLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-6 w-32" />
          </div>
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        <div className="flex gap-2 p-1 bg-muted rounded-lg">
          <Skeleton className="h-9 flex-1 rounded" />
          <Skeleton className="h-9 flex-1 rounded" />
        </div>

        {/* Date navigation skeleton */}
        <div className="flex items-center justify-between gap-2 py-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>

        {/* Food logs skeleton */}
        <div className="space-y-3 pb-20">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />

          {/* Stats card skeleton */}
          <div className="mt-6">
            <Skeleton className="h-32 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
