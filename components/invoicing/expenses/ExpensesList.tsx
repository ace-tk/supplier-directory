"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Paperclip, Receipt, Upload, Download } from "lucide-react";
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
import { listExpensesAction, deleteExpenseAction } from "@/services/expenses";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_OPTIONS } from "@/lib/expenses/ui";
import { formatMoney, formatShortDate } from "@/lib/invoicing/ui";
import type { ExpenseRecord, ExpenseCategory } from "@/types/expense";

export function ExpensesList({ basePath }: { basePath: string }) {
  const router = useRouter();
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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
      if (dateFrom && e.occurredAt < dateFrom) return false;
      if (dateTo && e.occurredAt.slice(0, 10) > dateTo) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${e.location ?? ""} ${e.notes ?? ""} ${e.partyName ?? ""} ${e.relatedInvoiceNumber ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [expenses, search, categoryFilter, dateFrom, dateTo]);

  const totalAmount = useMemo(() => filtered.reduce((sum, e) => sum + Number(e.amount), 0), [filtered]);
  const totalCurrency = filtered[0]?.currency ?? "INR";

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteExpenseAction(deleteTarget.id);
    if (!result.success) return toast.error(result.error);
    toast.success("Expense deleted");
    setDeleteTarget(null);
    refresh();
  }

  async function handleDownloadTemplate() {
    const { downloadExpenseImportTemplate } = await import("@/lib/expenses/expenses-io");
    downloadExpenseImportTemplate();
  }

  const columns: RecordColumn<ExpenseRecord>[] = [
    { key: "date", label: "Date", render: (e) => formatShortDate(e.occurredAt) },
    { key: "category", label: "Category", render: (e) => (e.category === "OTHER" && e.customCategoryLabel ? e.customCategoryLabel : EXPENSE_CATEGORY_LABELS[e.category]) },
    { key: "location", label: "Location", render: (e) => e.location || "—" },
    { key: "party", label: "Party", render: (e) => e.partyName || "—" },
    {
      key: "invoice",
      label: "Related Invoice",
      render: (e) =>
        e.relatedInvoiceNumber && e.relatedInvoiceId ? (
          <Link href={`${basePath}/${e.relatedInvoiceId}`} className="font-mono text-xs text-primary hover:underline">
            {e.relatedInvoiceNumber}
          </Link>
        ) : (
          "—"
        ),
    },
    { key: "amount", label: "Amount", render: (e) => <span className="tabular-nums">{formatMoney(e.amount, e.currency)}</span> },
    {
      key: "attachment",
      label: "",
      render: (e) =>
        e.attachmentUrl ? (
          <a href={e.attachmentUrl} target="_blank" rel="noopener noreferrer" aria-label="View attachment" className="text-muted-foreground hover:text-foreground">
            <Paperclip className="h-3.5 w-3.5" />
          </a>
        ) : null,
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
            render={<Link href={`${basePath}/expenses/${e.id}/edit`} />}
            nativeButton={false}
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
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadTemplate}>
              <Download className="h-3.5 w-3.5" /> Download Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              render={<Link href={`${basePath}/expenses/import`} />}
              nativeButton={false}
            >
              <Upload className="h-3.5 w-3.5" /> Import Excel
            </Button>
            <Button size="sm" className="gap-1.5" render={<Link href={`${basePath}/expenses/new`} />} nativeButton={false}>
              <Plus className="h-4 w-4" /> Add Expense
            </Button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search expenses..." className="pl-8 w-64" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
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
      </div>

      {!loading && filtered.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {filtered.length} expense{filtered.length === 1 ? "" : "s"}
          </span>
          <span className="font-semibold text-foreground tabular-nums">Total: {formatMoney(totalAmount, totalCurrency)}</span>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-border bg-card h-64 animate-pulse" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={expenses.length === 0 ? "No expenses yet" : "No expenses match your filters"}
          description={expenses.length === 0 ? "Log your first expense to start tracking operational costs." : "Try adjusting your search or filters."}
          action={expenses.length === 0 ? { label: "Add Expense", onClick: () => router.push(`${basePath}/expenses/new`) } : undefined}
        />
      ) : (
        <RecordsTable columns={columns} rows={filtered} />
      )}

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
