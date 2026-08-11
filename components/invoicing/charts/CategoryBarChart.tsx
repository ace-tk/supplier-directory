import { formatMoney } from "@/lib/invoicing/ui";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/expenses/ui";
import { getCategoryColor } from "@/lib/expenses/category-colors";
import type { ExpenseCategory } from "@/types/expense";

interface CategoryDatum {
  category: string;
  amount: string;
}

export function CategoryBarChart({ data, currency = "INR" }: { data: CategoryDatum[]; currency?: string }) {
  if (data.length === 0) {
    return <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">No expenses recorded for this period.</div>;
  }

  const max = Math.max(...data.map((d) => Number(d.amount)));

  return (
    <div className="space-y-2.5">
      {data.map((d) => {
        const color = getCategoryColor({ category: d.category as ExpenseCategory });
        return (
          <div key={d.category} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{EXPENSE_CATEGORY_LABELS[d.category as ExpenseCategory] ?? d.category}</span>
              <span className="tabular-nums font-medium text-foreground">{formatMoney(d.amount, currency)}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${color.dot}`}
                style={{ width: `${max > 0 ? (Number(d.amount) / max) * 100 : 0}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

