"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Paperclip, Receipt } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordsTable, type RecordColumn } from "@/components/portal/records-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ExpenseFormDialog } from "./ExpenseFormDialog";
import { listExpensesAction, deleteExpenseAction } from "@/services/expenses";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_OPTIONS } from "@/lib/expenses/ui";
import { formatMoney, formatShortDate } from "@/lib/invoicing/ui";
import type { ExpenseRecord, ExpenseCategory } from "@/types/expense";

export function ExpensesList({ basePath }: { basePath: string }) {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ExpenseRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRecord | null>(null);

  function refresh() {
    listExpensesAction({}).then((r) => {
      if (r.success) setExpenses(r.data);
      setLoading(false);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (categoryFilter !== "All" && e.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${e.location ?? ""} ${e.notes ?? ""} ${e.partyName ?? ""} ${e.relatedInvoiceNumber ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [expenses, search, categoryFilter]);

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteExpenseAction(deleteTarget.id);
    if (!result.success) return toast.error(result.error);
    toast.success("Expense deleted");
    setDeleteTarget(null);
    refresh();
  }

  const columns: RecordColumn<ExpenseRecord>[] = [
    { key: "date", label: "Date", render: (e) => formatShortDate(e.occurredAt) },
    { key: "category", label: "Category", render: (e) => (e.category === "OTHER" && e.customCategoryLabel ? e.customCategoryLabel : EXPENSE_CATEGORY_LABELS[e.category]) },
    { key: "location", label: "Location", render: (e) => e.location || "—" },
    { key: "party", label: "Party", render: (e) => e.partyName || "—" },
    { key: "invoice", label: "Related Invoice", render: (e) => (e.relatedInvoiceNumber ? <span className="font-mono text-xs">{e.relatedInvoiceNumber}</span> : "—") },
    { key: "amount", label: "Amount", render: (e) => <span className="tabular-nums">{formatMoney(e.amount, e.currency)}</span> },
    {
      key: "attachment",
      label: "",
      render: (e) => (e.attachmentUrl ? <Paperclip className="h-3.5 w-3.5 text-muted-foreground" /> : null),
    },
    {
      key: "actions",
      label: "",
      render: (e) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Edit"
            onClick={() => {
              setEditTarget(e);
              setDialogOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteTarget(e)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Operational costs — shipping, travel, samples, and more. Kept separate from invoice line items."
        breadcrumbs={[{ label: "Invoice Management", href: basePath }, { label: "Expenses" }]}
        actions={
          <Button
            className="gap-1.5"
            onClick={() => {
              setEditTarget(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add Expense
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search expenses..." className="pl-8 w-64" />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => v && setCategoryFilter(v)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Categories</SelectItem>
            {EXPENSE_CATEGORY_OPTIONS.map((c: ExpenseCategory) => (
              <SelectItem key={c} value={c}>
                {EXPENSE_CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card h-64 animate-pulse" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={expenses.length === 0 ? "No expenses yet" : "No expenses match your filters"}
          description={expenses.length === 0 ? "Log your first expense to start tracking operational costs." : "Try adjusting your search or filters."}
          action={expenses.length === 0 ? { label: "Add Expense", onClick: () => setDialogOpen(true) } : undefined}
        />
      ) : (
        <RecordsTable columns={columns} rows={filtered} />
      )}

      <ExpenseFormDialog expense={editTarget} open={dialogOpen} onOpenChange={setDialogOpen} onSaved={refresh} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>This expense record will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
