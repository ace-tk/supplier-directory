import { Skeleton } from "@/components/ui/skeleton";

/** Route-transition placeholder: shimmering blocks that mirror a typical page. */
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-[20px]" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-[20px]" />
    </div>
  );
}
