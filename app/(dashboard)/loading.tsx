import { SkeletonPage, PageHeaderSkeleton, StatCardsSkeleton, CardGridSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage>
      <PageHeaderSkeleton />
      <StatCardsSkeleton />
      <CardGridSkeleton count={4} />
    </SkeletonPage>
  );
}
