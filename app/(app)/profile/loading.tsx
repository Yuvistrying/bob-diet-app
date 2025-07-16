import { Skeleton } from "~/app/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Profile header skeleton */}
        <div className="text-center mb-8">
          <Skeleton className="h-24 w-24 rounded-full mx-auto mb-4" />
          <Skeleton className="h-8 w-48 mx-auto mb-2" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>

        {/* Stats cards skeleton */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>

        {/* Settings section skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-32 mb-4" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />

          {/* Action buttons skeleton */}
          <div className="pt-6 space-y-3">
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
