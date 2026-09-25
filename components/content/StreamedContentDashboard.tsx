import { Suspense } from "react";
import { getContentListForOwner, getTemplatesForOwner } from "@/lib/content-queries";
import { ContentDashboard } from "@/components/content/ContentDashboard";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";

// Streams the content + template queries instead of blocking the whole
// response on them: the page shell + this skeleton flush immediately, then
// ContentDashboard streams in with the same server-fetched initial data as
// before (so it still skips its own client-side fetch on mount).
async function ContentDashboardData({ basePath, userId }: { basePath: string; userId: string }) {
  const [initialItems, initialTemplates] = await Promise.all([getContentListForOwner(userId), getTemplatesForOwner(userId)]);
  return <ContentDashboard basePath={basePath} initialItems={initialItems} initialTemplates={initialTemplates} />;
}

// Mirrors ContentDashboard's header, tabs/toolbar and its own `loading` grid.
export function ContentDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Management"
        description="Create and manage rich content across your organization."
        actions={
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-8 w-36" />
          </div>
        }
      />
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <Skeleton className="h-8 w-full max-w-lg" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-40" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card h-64 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export function StreamedContentDashboard({ basePath, userId }: { basePath: string; userId: string }) {
  return (
    <Suspense fallback={<ContentDashboardSkeleton />}>
      <ContentDashboardData basePath={basePath} userId={userId} />
    </Suspense>
  );
}
