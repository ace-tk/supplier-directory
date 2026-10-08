import { AlertTriangle } from "lucide-react";

export function LowStockBanner({ lowStockCount, outOfStockCount }: { lowStockCount: number; outOfStockCount: number }) {
  if (lowStockCount === 0 && outOfStockCount === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-butter-ink/20 bg-butter px-4 py-3 mb-6">
      <AlertTriangle className="h-4 w-4 text-butter-ink shrink-0" />
      <p className="text-sm text-butter-ink">
        <span className="font-medium">{lowStockCount} item{lowStockCount !== 1 ? "s" : ""}</span> running low on stock
        {outOfStockCount > 0 && (
          <>
            {" "}and <span className="font-medium">{outOfStockCount} item{outOfStockCount !== 1 ? "s" : ""}</span> out of stock
          </>
        )}
        . Review and restock to avoid missed orders.
      </p>
    </div>
  );
}
