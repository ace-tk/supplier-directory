import { SkeletonPage, PageHeaderSkeleton, ToolbarSkeleton, CardGridSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage>
      <PageHeaderSkeleton actions />
      <ToolbarSkeleton />
      <CardGridSkeleton count={6} />
    </SkeletonPage>
  );
}
