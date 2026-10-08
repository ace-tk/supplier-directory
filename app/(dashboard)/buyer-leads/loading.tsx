import { SkeletonPage, PageHeaderSkeleton, ToolbarSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage>
      <PageHeaderSkeleton actions />
      <ToolbarSkeleton />
      <TableSkeleton />
    </SkeletonPage>
  );
}
