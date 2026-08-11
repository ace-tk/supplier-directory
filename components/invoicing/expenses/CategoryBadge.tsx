import { getCategoryColor } from "@/lib/expenses/category-colors";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/expenses/ui";
import { cn } from "@/lib/utils";
import type { ExpenseCategory } from "@/types/expense";

export function categoryDisplayLabel(input: { category: ExpenseCategory; customCategoryLabel?: string | null }): string {
  if (input.category === "OTHER" && input.customCategoryLabel) return input.customCategoryLabel;
  return EXPENSE_CATEGORY_LABELS[input.category];
}

export function CategoryBadge({
  category,
  customCategoryId,
  customCategoryLabel,
  className,
}: {
  category: ExpenseCategory;
  customCategoryId?: string | null;
  customCategoryLabel?: string | null;
  className?: string;
}) {
  const color = getCategoryColor({ category, customCategoryId, customCategoryLabel });
  const label = categoryDisplayLabel({ category, customCategoryLabel });
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        color.bg,
        color.text,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", color.dot)} />
      {label}
    </span>
  );
}
