import { SkeletonPage, PageHeaderSkeleton, CardGridSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage>
      <PageHeaderSkeleton actions />
      <CardGridSkeleton count={8} />
    </SkeletonPage>
  );
}
