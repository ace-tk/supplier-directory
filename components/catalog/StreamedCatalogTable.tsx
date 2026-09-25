import { Suspense } from "react";
import { getOrCreateCatalogForOwner } from "@/lib/catalog-queries";
import { CatalogTable } from "@/components/catalog/CatalogTable";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";

// Streams the catalog query instead of blocking the whole response on it:
// the page shell + this skeleton flush immediately, then CatalogTable
// streams in with the same server-fetched initialCatalog as before (so it
// still skips its own client-side fetch on mount).
async function CatalogTableData({ basePath, userId }: { basePath: string; userId: string }) {
  const initialCatalog = await getOrCreateCatalogForOwner(userId);
  return <CatalogTable basePath={basePath} initialCatalog={initialCatalog} />;
}

// Mirrors CatalogTable's header, toolbar and its own `loading` placeholder.
export function CatalogTableSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Catalog Management" description="Build and manage your product catalog like a spreadsheet." />
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-20" />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card h-64 animate-pulse" />
    </div>
  );
}

export function StreamedCatalogTable({ basePath, userId }: { basePath: string; userId: string }) {
  return (
    <Suspense fallback={<CatalogTableSkeleton />}>
      <CatalogTableData basePath={basePath} userId={userId} />
    </Suspense>
  );
}
