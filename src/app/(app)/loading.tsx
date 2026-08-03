import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";

/** Route-level loading state for every page in the app shell. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-11 w-full" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass space-y-3 p-4">
          <Skeleton className="h-4 w-32" />
          <SkeletonRows rows={4} />
        </div>
        <div className="glass space-y-3 p-4">
          <Skeleton className="h-4 w-32" />
          <SkeletonRows rows={4} />
        </div>
      </div>
    </div>
  );
}
