"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search, MoreVertical, Eye, Pencil, Copy, Archive, FileText, ArrowRightLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/portal/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordsTable, type RecordColumn } from "@/components/portal/records-table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { duplicateInvoiceAction, archiveInvoiceAction, listInvoicesAction } from "@/services/invoicing";
import { DISPLAYABLE_STATUSES_BY_TYPE } from "@/lib/invoicing/status";
import { INVOICE_STATUS_LABELS, formatMoney, formatShortDate } from "@/lib/invoicing/ui";
import type { InvoiceSummary } from "@/types/invoicing";

/** Quotations/Estimates — its own small sibling of InvoiceList: single type
 * (QUOTATION), but needs a "Converted Invoice" column InvoiceList has no
 * use for. Same listInvoicesAction/RecordsTable/EmptyState underneath. */
export function QuotationList({ basePath, createAction }: { basePath: string; createAction: React.ReactNode }) {
  const [rows, setRows] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const statusOptions = DISPLAYABLE_STATUSES_BY_TYPE.QUOTATION;

  function refresh() {
    listInvoicesAction({ types: ["QUOTATION"] }).then((r) => {
      if (r.success) setRows(r.data);
      setLoading(false);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((inv) => {
      if (statusFilter !== "All" && inv.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!inv.invoiceNumber.toLowerCase().includes(q) && !inv.partyName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter]);

  async function handleDuplicate(id: string) {
    const result = await duplicateInvoiceAction(id);
    if (!result.success) return toast.error(result.error);
    toast.success("Quotation duplicated");
    refresh();
  }

  async function handleArchive(id: string) {
    const result = await archiveInvoiceAction(id);
    if (!result.success) return toast.error(result.error);
    toast.success("Quotation archived");
    refresh();
  }

  const columns: RecordColumn<InvoiceSummary>[] = useMemo(
    () => [
      { key: "invoiceNumber", label: "Quotation #", render: (i) => <span className="font-mono text-xs">{i.invoiceNumber}</span> },
      { key: "party", label: "Buyer", render: (i) => <span className="font-medium text-foreground">{i.partyName}</span> },
      { key: "date", label: "Date", render: (i) => formatShortDate(i.invoiceDate) },
      { key: "dueDate", label: "Valid / Due Date", render: (i) => formatShortDate(i.dueDate) },
      { key: "amount", label: "Amount", render: (i) => <span className="tabular-nums">{formatMoney(i.grandTotal, i.currency)}</span> },
      { key: "status", label: "Status", render: (i) => <StatusBadge status={INVOICE_STATUS_LABELS[i.status]} /> },
      {
        key: "converted",
        label: "Converted Invoice",
        render: (i) =>
          i.convertedInvoice ? (
            <Link
              href={`${basePath}/${i.convertedInvoice.id}`}
              className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
            >
              <ArrowRightLeft className="h-3 w-3" /> {i.convertedInvoice.invoiceNumber}
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "actions",
        label: "",
        render: (i) => (
          <div className="flex items-center justify-end gap-0.5">
            <Button variant="ghost" size="icon-sm" aria-label="View" render={<Link href={`${basePath}/${i.id}`} />} nativeButton={false}>
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {i.status === "DRAFT" && (
              <Button variant="ghost" size="icon-sm" aria-label="Edit" render={<Link href={`${basePath}/${i.id}/edit`} />} nativeButton={false}>
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
    [basePath]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations / Estimates"
        description="Create and manage quotations before converting them into invoices."
        breadcrumbs={[
          { label: "Invoice Management", href: basePath },
          { label: "Sales", href: `${basePath}/sales` },
          { label: "Quotations / Estimates" },
        ]}
        actions={createAction}
      />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search quotations..." className="pl-8 w-64" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Status</SelectItem>
            {statusOptions.map((s) => (
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
          icon={FileText}
          title={search || statusFilter !== "All" ? "No quotations match your filters" : "Quotations / Estimates"}
          description={
            search || statusFilter !== "All"
              ? "Try adjusting your search or filters."
              : "Send a quotation to a buyer, then convert it into a Tax Invoice once they accept."
          }
        />
      ) : (
        <RecordsTable columns={columns} rows={filtered} />
      )}
    </div>
  );
}
