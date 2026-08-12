"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Plus, Loader2, Tags } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { CategoryBadge } from "@/components/invoicing/expenses/CategoryBadge";
import { listExpensesAction, listExpenseCustomCategoriesAction, createExpenseCustomCategoryAction } from "@/services/expenses";
import { EXPENSE_CATEGORY_OPTIONS } from "@/lib/expenses/ui";
import type { ExpenseRecord, ExpenseCustomCategoryOption } from "@/types/expense";

/**
 * A real, functional categories surface — not a fixed enum list. System
 * categories (from the ExpenseCategory enum) are always shown; custom
 * categories are DB-backed (ExpenseCustomCategory) and reuse the exact
 * same list/create actions as the CategoryPicker inside the Expense form.
 * Counts come from real expense rows, never invented.
 */
export function ExpenseCategoriesPage({ basePath }: { basePath: string }) {
  const expensesPath = `${basePath}/expenses`;
  const [expenses, setExpenses] = useState<ExpenseRecord[] | null>(null);
  const [customCategories, setCustomCategories] = useState<ExpenseCustomCategoryOption[] | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [creating, setCreating] = useState(false);

  function refresh() {
    listExpensesAction({}).then((r) => setExpenses(r.success ? r.data : []));
    listExpenseCustomCategoriesAction().then((r) => setCustomCategories(r.success ? r.data : []));
  }

  useEffect(() => {
    refresh();
  }, []);

  const systemCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of expenses ?? []) {
      if (e.category !== "OTHER" || !e.customCategoryId) {
        counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
      }
    }
    return counts;
  }, [expenses]);

  const customCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of expenses ?? []) {
      if (e.customCategoryId) counts.set(e.customCategoryId, (counts.get(e.customCategoryId) ?? 0) + 1);
    }
    return counts;
  }, [expenses]);

  async function handleCreate() {
    const name = newCategory.trim();
    if (!name) return;
    setCreating(true);
    const result = await createExpenseCustomCategoryAction(name);
    setCreating(false);
    if (!result.success) return toast.error(result.error);
    setNewCategory("");
    toast.success(`Category "${result.data.name}" added`);
    refresh();
  }

  const loading = expenses === null || customCategories === null;

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Expense Categories"
        description="System categories are always available. Add your own to keep expenses organized your way."
        breadcrumbs={[{ label: "Invoice Management", href: basePath }, { label: "Expenses", href: expensesPath }, { label: "Categories" }]}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" render={<Link href={expensesPath} />} nativeButton={false}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Expenses
          </Button>
        }
      />

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Add Category</h2>
        <div className="flex items-center gap-2">
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
            placeholder="e.g. Fabric Testing, Courier"
          />
          <Button onClick={handleCreate} disabled={creating || !newCategory.trim()} className="gap-1.5 shrink-0">
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="h-40 rounded-2xl border border-border bg-card animate-pulse" />
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">System Categories</h2>
            <div className="space-y-1.5">
              {EXPENSE_CATEGORY_OPTIONS.map((c) => (
                <div key={c} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                  <CategoryBadge category={c} />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {systemCounts.get(c) ?? 0} expense{(systemCounts.get(c) ?? 0) === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Custom Categories</h2>
            {customCategories && customCategories.length === 0 ? (
              <EmptyState icon={Tags} title="No custom categories yet" description="Add one above to start organizing expenses your way." />
            ) : (
              <div className="space-y-1.5">
                {customCategories?.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                    <CategoryBadge category="OTHER" customCategoryId={c.id} customCategoryLabel={c.name} />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {customCounts.get(c.id) ?? 0} expense{(customCounts.get(c.id) ?? 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
