import { Suspense } from "react";
import { Building2 } from "lucide-react";
import { getSupplierDirectory } from "@/lib/supplier-queries";
import { DirectoryView } from "@/components/suppliers/DirectoryView";
import { SkeletonCard } from "@/components/suppliers/skeleton-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Supplier } from "@/types/supplier";

// Streams the directory query instead of blocking the whole response on it:
// the page shell + this skeleton flush immediately, then DirectoryView
// streams in with the same server-fetched initialSuppliers as before (so
// useSuppliers still skips its own client-side fetch on mount).
async function DirectoryViewData() {
  const rows = await getSupplierDirectory();
  const initialSuppliers: Supplier[] = rows.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));
  return <DirectoryView initialSuppliers={initialSuppliers} />;
}

// Mirrors DirectoryView's header, stats strip (with its "—" loading values),
// search/filter rows and its own SkeletonCard loading grid.
export function DirectoryViewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Supplier Directory</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            Discover verified manufacturers and exporters from around the world.
          </p>
        </div>
        <Skeleton className="h-7 w-32 shrink-0 self-start sm:self-auto" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {["Total Suppliers", "Verified", "Countries", "Industries"].map((label) => (
          <div key={label} className="rounded-xl bg-card border border-border px-4 py-3">
            <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
            <p className="text-xl font-semibold tabular-nums text-foreground">—</p>
          </div>
        ))}
      </div>

      <Skeleton className="h-24 w-full rounded-xl" />

      <div className="flex items-center gap-3">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-[68px] shrink-0" />
      </div>

      <Skeleton className="h-7 w-full max-w-2xl" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

export function StreamedDirectoryView() {
  return (
    <Suspense fallback={<DirectoryViewSkeleton />}>
      <DirectoryViewData />
    </Suspense>
  );
}
