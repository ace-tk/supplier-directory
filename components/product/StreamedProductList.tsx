import { Suspense } from "react";
import { getOrCreateCatalogForOwner } from "@/lib/catalog-queries";
import { ProductList } from "@/components/product/ProductList";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";

// Streams the catalog query instead of blocking the whole response on it:
// the page shell + this skeleton flush immediately, then ProductList
// streams in with the same server-fetched initialCatalog as before (so it
// still skips its own client-side fetch on mount).
async function ProductListData({ basePath, userId }: { basePath: string; userId: string }) {
  const initialCatalog = await getOrCreateCatalogForOwner(userId);
  return <ProductList basePath={basePath} initialCatalog={initialCatalog} />;
}

// Mirrors ProductList's header, tabs, toolbar and its own `loading` placeholder.
export function ProductListSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Product"
        description="Add and manage products — shared with Catalog Management and available to Invoice line items."
      />
      <Skeleton className="h-8 w-80" />
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <Skeleton className="h-8 w-64" />
        <div className="flex items-center gap-2 flex-wrap">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-9 w-[68px]" />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card h-64 animate-pulse" />
    </div>
  );
}

export function StreamedProductList({ basePath, userId }: { basePath: string; userId: string }) {
  return (
    <Suspense fallback={<ProductListSkeleton />}>
      <ProductListData basePath={basePath} userId={userId} />
    </Suspense>
  );
}
