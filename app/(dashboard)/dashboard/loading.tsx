import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPage, StatCardsSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage>
      <Skeleton className="h-44 w-full rounded-[20px]" />
      <StatCardsSkeleton />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="h-72 rounded-[20px]" />
        <Skeleton className="h-72 rounded-[20px]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-[20px]" />
        <Skeleton className="h-64 rounded-[20px]" />
        <Skeleton className="h-64 rounded-[20px]" />
      </div>
    </SkeletonPage>
  );
}
