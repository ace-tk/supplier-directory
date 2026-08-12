"use client";

import Link from "next/link";
import { Receipt } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { categoryDisplayLabel } from "./CategoryBadge";
import { formatMoney, formatShortDate } from "@/lib/invoicing/ui";
import { getCategoryColor } from "@/lib/expenses/category-colors";
import type { ExpenseRecord } from "@/types/expense";

export function RecentExpensesPanel({ basePath, expenses }: { basePath: string; expenses: ExpenseRecord[] | null }) {
  const expensesPath = `${basePath}/expenses`;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground">Recent Expenses</h3>
        <Link href={expensesPath} className="text-[11px] font-medium text-primary hover:underline">
          View All
        </Link>
      </div>

      {expenses === null ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <EmptyState icon={Receipt} title="No expenses yet" description="Your saved expenses will show up here." />
      ) : (
        <div className="space-y-1">
          {expenses.map((e) => {
            const color = getCategoryColor({ category: e.category, customCategoryId: e.customCategoryId, customCategoryLabel: e.customCategoryLabel });
            return (
              <Link
                key={e.id}
                href={`${expensesPath}/${e.id}/edit`}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors"
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${color.dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground truncate">{categoryDisplayLabel({ category: e.category, customCategoryLabel: e.customCategoryLabel })}</p>
                  <p className="text-[10px] text-muted-foreground">{formatShortDate(e.occurredAt)}</p>
                </div>
                <span className="text-xs font-medium text-foreground tabular-nums shrink-0">{formatMoney(e.amount, e.currency)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
