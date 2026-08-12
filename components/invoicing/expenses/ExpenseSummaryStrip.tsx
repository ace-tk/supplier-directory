"use client";

import { formatMoney } from "@/lib/invoicing/ui";
import { categoryDisplayLabel } from "./CategoryBadge";
import type { ExpenseCategory } from "@/types/expense";

/** Live-updating strip — every value is derived straight from the form
 * state passed in, never hardcoded. */
export function ExpenseSummaryStrip({
  amount,
  currency,
  date,
  category,
  customCategoryLabel,
}: {
  amount: string;
  currency: string;
  date: string;
  category: ExpenseCategory | null;
  customCategoryLabel: string;
}) {
  const dateLabel = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", weekday: "short" })
    : "Not set";

  const categoryLabel = category ? categoryDisplayLabel({ category, customCategoryLabel }) : "Not selected";

  return (
    <div className="grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3">
        <p className="text-[11px] text-muted-foreground">Total Amount</p>
        <p className="text-lg font-semibold text-foreground tabular-nums mt-0.5">{formatMoney(amount || "0", currency)}</p>
      </div>
      <div className="px-4 py-3">
        <p className="text-[11px] text-muted-foreground">Transaction Date</p>
        <p className="text-sm font-medium text-foreground mt-1">{dateLabel}</p>
      </div>
      <div className="px-4 py-3 min-w-0">
        <p className="text-[11px] text-muted-foreground">Category</p>
        <p className="text-sm font-medium text-foreground mt-1 truncate">{categoryLabel}</p>
      </div>
    </div>
  );
}
