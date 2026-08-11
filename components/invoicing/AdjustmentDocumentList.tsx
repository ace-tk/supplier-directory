"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search, MoreVertical, Eye, Pencil, Copy, Archive, FileMinus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/portal/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordsTable, type RecordColumn } from "@/components/portal/records-table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { duplicateInvoiceAction, archiveInvoiceAction, listInvoicesAction } from "@/services/invoicing";
import { invoiceFamily } from "@/lib/invoicing/family";
import { DISPLAYABLE_STATUSES_BY_TYPE } from "@/lib/invoicing/status";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  INVOICE_REASON_LABELS,
  formatMoney,
  formatShortDate,
} from "@/lib/invoicing/ui";
import type { InvoiceSummary, InvoiceType } from "@/types/invoicing";

/** Credit Note/Sales Return (Sales side) or Debit Note (Purchase side) —
 * these adjustment documents share one shape (a Source Invoice + Reason),
 * distinct from the plain invoice table, so they get their own small
 * sibling of InvoiceList rather than overloading it with conditional
 * columns. Same listInvoicesAction/RecordsTable/EmptyState underneath. */
export function AdjustmentDocumentList({
  basePath,
  types,
  title,
  description,
  createAction,
  showTypeColumn,
}: {
  basePath: string;
  types: InvoiceType[];
  title: string;
  description: string;
  createAction: React.ReactNode;
  showTypeColumn: boolean;
}) {
  const [rows, setRows] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const family = useMemo(() => invoiceFamily(types[0]), [types]);
  const statusOptions = useMemo(() => {
    const seen = new Set<string>();
    return types.flatMap((t) => DISPLAYABLE_STATUSES_BY_TYPE[t]).filter((s) => (seen.has(s) ? false : seen.add(s)));
  }, [types]);

  function refresh() {
    listInvoicesAction({ types }).then((r) => {
      if (r.success) setRows(r.data);
      setLoading(false);
    });
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types.join(",")]);

  const filtered = useMemo(() => {
    return rows.filter((inv) => {
      if (statusFilter !== "All" && inv.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !inv.invoiceNumber.toLowerCase().includes(q) &&
          !inv.partyName.toLowerCase().includes(q) &&
          !(inv.sourceInvoiceNumber ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [rows, search, statusFilter]);

  async function handleDuplicate(id: string) {
    const result = await duplicateInvoiceAction(id);
    if (!result.success) return toast.error(result.error);
    toast.success("Document duplicated");
    refresh();
  }

  async function handleArchive(id: string) {
    const result = await archiveInvoiceAction(id);
    if (!result.success) return toast.error(result.error);
    toast.success("Document archived");
    refresh();
  }

  const sectionHref = `${basePath}/${family === "SALES" ? "sales" : "purchase"}`;

  const columns: RecordColumn<InvoiceSummary>[] = useMemo(
    () => [
      { key: "invoiceNumber", label: "Document #", render: (i) => <span className="font-mono text-xs">{i.invoiceNumber}</span> },
      ...(showTypeColumn
        ? [{ key: "docType", label: "Type", render: (i: InvoiceSummary) => <span className="text-xs text-muted-foreground">{INVOICE_TYPE_LABELS[i.type]}</span> } as RecordColumn<InvoiceSummary>]
        : []),
      {
        key: "party",
        label: family === "SALES" ? "Buyer" : "Supplier",
        render: (i) => <span className="font-medium text-foreground">{i.partyName}</span>,
      },
      {
        key: "source",
        label: "Source Invoice",
        render: (i) =>
          i.sourceInvoiceId && i.sourceInvoiceNumber ? (
            <Link href={`${basePath}/${i.sourceInvoiceId}`} className="font-mono text-xs text-primary hover:underline">
              {i.sourceInvoiceNumber}
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      { key: "date", label: "Date", render: (i) => formatShortDate(i.invoiceDate) },
      { key: "reason", label: "Reason", render: (i) => (i.reason ? INVOICE_REASON_LABELS[i.reason] : <span className="text-muted-foreground">—</span>) },
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
    [basePath, family, showTypeColumn]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={[
          { label: "Invoice Management", href: basePath },
          { label: family === "SALES" ? "Sales" : "Purchases", href: sectionHref },
          { label: title },
        ]}
        actions={createAction}
      />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-8 w-64" />
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
          icon={FileMinus}
          title={search || statusFilter !== "All" ? "No documents match your filters" : title}
          description={
            search || statusFilter !== "All"
              ? "Try adjusting your search or filters."
              : `Nothing here yet. ${description}`
          }
        />
      ) : (
        <RecordsTable columns={columns} rows={filtered} />
      )}
    </div>
  );
}
