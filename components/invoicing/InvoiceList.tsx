"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search, MoreVertical, Eye, Pencil, Copy, Archive, Receipt, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/portal/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordsTable, type RecordColumn } from "@/components/portal/records-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateDocumentMenu } from "@/components/invoicing/CreateDocumentMenu";
import { listInvoicesAction, duplicateInvoiceAction, archiveInvoiceAction } from "@/services/invoicing";
import { typesForFamily, type InvoiceFamily } from "@/lib/invoicing/family";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_OPTIONS, INVOICE_TYPE_LABELS, formatMoney, formatShortDate } from "@/lib/invoicing/ui";
import type { InvoiceSummary } from "@/types/invoicing";

export function InvoiceList({ basePath, family }: { basePath: string; family: InvoiceFamily }) {
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const types = useMemo(() => typesForFamily(family), [family]);

  function refresh() {
    listInvoicesAction({ types }).then((r) => {
      if (r.success) setInvoices(r.data);
      setLoading(false);
    });
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== "All" && inv.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!inv.invoiceNumber.toLowerCase().includes(q) && !inv.partyName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [invoices, search, statusFilter]);

  async function handleDuplicate(id: string) {
    const result = await duplicateInvoiceAction(id);
    if (!result.success) return toast.error(result.error);
    toast.success("Invoice duplicated");
    refresh();
  }

  async function handleArchive(id: string) {
    const result = await archiveInvoiceAction(id);
    if (!result.success) return toast.error(result.error);
    toast.success("Invoice archived");
    refresh();
  }

  const label = family === "SALES" ? "Sales" : "Purchase";
  const Icon = family === "SALES" ? Receipt : ShoppingCart;

  const columns: RecordColumn<InvoiceSummary>[] = useMemo(
    () => [
      { key: "invoiceNumber", label: "Invoice #", render: (i) => <span className="font-mono text-xs">{i.invoiceNumber}</span> },
      {
        key: "party",
        label: family === "SALES" ? "Buyer" : "Supplier",
        render: (i) => <span className="font-medium text-foreground">{i.partyName}</span>,
      },
      { key: "docType", label: "Document Type", render: (i) => <span className="text-xs text-muted-foreground">{INVOICE_TYPE_LABELS[i.type]}</span> },
      { key: "invoiceDate", label: "Invoice Date", render: (i) => formatShortDate(i.invoiceDate) },
      { key: "dueDate", label: "Due Date", render: (i) => formatShortDate(i.dueDate) },
      { key: "amount", label: "Amount", render: (i) => <span className="tabular-nums">{formatMoney(i.grandTotal, i.currency)}</span> },
      { key: "status", label: "Status", render: (i) => <StatusBadge status={INVOICE_STATUS_LABELS[i.status]} /> },
      {
        key: "actions",
        label: "",
        render: (i) => (
          <div className="flex items-center justify-end gap-0.5">
            <Button variant="ghost" size="icon-sm" aria-label="View" render={<Link href={`${basePath}/${i.id}`} />} nativeButton={false}>
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {i.status === "DRAFT" && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit"
                render={<Link href={`${basePath}/${i.id}/edit`} />}
                nativeButton={false}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}>
                <MoreVertical className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleDuplicate(i.id)}>
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => handleArchive(i.id)}>
                  <Archive className="h-3.5 w-3.5" /> Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
        className: "text-right",
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [basePath, family]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${label} Management`}
        description={family === "SALES" ? "Invoices, quotations, and adjustments for your buyers and customers." : "Bills and adjustments for your suppliers and vendors."}
        breadcrumbs={[{ label: "Invoice Management", href: basePath }, { label }]}
        actions={<CreateDocumentMenu basePath={basePath} family={family} />}
      />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoices..." className="pl-8 w-64" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Status</SelectItem>
            {INVOICE_STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {INVOICE_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card h-64 animate-pulse" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Icon}
          title={search || statusFilter !== "All" ? "No invoices match your filters" : `No ${label.toLowerCase()} documents yet`}
          description={
            search || statusFilter !== "All"
              ? "Try adjusting your search or filters."
              : `Create your first ${label.toLowerCase()} document to get started.`
          }
        />
      ) : (
        <RecordsTable columns={columns} rows={filtered} />
      )}
    </div>
  );
}
