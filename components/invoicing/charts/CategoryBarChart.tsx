import { formatMoney } from "@/lib/invoicing/ui";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/expenses/ui";
import type { ExpenseCategory } from "@/types/expense";

interface CategoryDatum {
  category: string;
  amount: string;
}

const BAR_COLORS = ["var(--color-primary)", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899"];

export function CategoryBarChart({ data, currency = "INR" }: { data: CategoryDatum[]; currency?: string }) {
  if (data.length === 0) {
    return <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">No expenses recorded for this period.</div>;
  }

  const max = Math.max(...data.map((d) => Number(d.amount)));

  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={d.category} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{EXPENSE_CATEGORY_LABELS[d.category as ExpenseCategory] ?? d.category}</span>
            <span className="tabular-nums font-medium text-foreground">{formatMoney(d.amount, currency)}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${max > 0 ? (Number(d.amount) / max) * 100 : 0}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

