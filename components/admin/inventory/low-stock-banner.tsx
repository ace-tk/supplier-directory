import { AlertTriangle } from "lucide-react";

export function LowStockBanner({ lowStockCount, outOfStockCount }: { lowStockCount: number; outOfStockCount: number }) {
  if (lowStockCount === 0 && outOfStockCount === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 mb-6">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <p className="text-sm text-amber-700 dark:text-amber-300">
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
