import { SkeletonPage, PageHeaderSkeleton, ToolbarSkeleton, CardGridSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage>
      <PageHeaderSkeleton />
      <ToolbarSkeleton />
      <CardGridSkeleton count={8} />
    </SkeletonPage>
  );
}
