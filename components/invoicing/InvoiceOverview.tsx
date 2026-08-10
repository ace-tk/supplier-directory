"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Receipt,
  ShoppingCart,
  Wallet,
  CircleCheck,
  AlertTriangle,
  FileClock,
  ArrowRight,
  LayoutGrid,
  Boxes,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { StatWidget } from "@/components/portal/stat-widget";
import { StatusBadge } from "@/components/portal/status-badge";
import { RecordsTable, type RecordColumn } from "@/components/portal/records-table";
import { EmptyState } from "@/components/shared/empty-state";
import { CreateDocumentMenu } from "@/components/invoicing/CreateDocumentMenu";
import { getInvoiceDashboardStatsAction } from "@/services/invoicing";
import { INVOICE_STATUS_LABELS, INVOICE_TYPE_LABELS, formatMoney, formatShortDate } from "@/lib/invoicing/ui";
import type { InvoiceDashboardStats, InvoiceSummary } from "@/types/invoicing";

export function InvoiceOverview({ basePath, inventoryPath }: { basePath: string; inventoryPath?: string }) {
  const [stats, setStats] = useState<InvoiceDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const catalogPath = basePath.replace(/\/invoices$/, "/catalog");

  useEffect(() => {
    getInvoiceDashboardStatsAction().then((r) => {
      if (r.success) setStats(r.data);
      setLoading(false);
    });
  }, []);

  const columns: RecordColumn<InvoiceSummary>[] = [
    { key: "invoiceNumber", label: "Invoice Number", render: (i) => <span className="font-mono text-xs">{i.invoiceNumber}</span> },
    { key: "party", label: "Party", render: (i) => <span className="font-medium text-foreground">{i.partyName}</span> },
    {
      key: "type",
      label: "Type",
      render: (i) => <span className="text-xs text-muted-foreground">{INVOICE_TYPE_LABELS[i.type]}</span>,
    },
    { key: "invoiceDate", label: "Invoice Date", render: (i) => formatShortDate(i.invoiceDate) },
    { key: "dueDate", label: "Due Date", render: (i) => formatShortDate(i.dueDate) },
    {
      key: "amount",
      label: "Amount",
      render: (i) => <span className="tabular-nums">{formatMoney(i.grandTotal, i.currency)}</span>,
    },
    { key: "status", label: "Status", render: (i) => <StatusBadge status={INVOICE_STATUS_LABELS[i.status]} /> },
    {
      key: "actions",
      label: "",
      render: (i) => (
        <Button variant="ghost" size="sm" className="gap-1" render={<Link href={`${basePath}/${i.id}`} />} nativeButton={false}>
          View <ArrowRight className="h-3 w-3" />
        </Button>
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoice Management"
        description="Track sales and purchase invoices in one place."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" render={<Link href={catalogPath} />} nativeButton={false}>
              <LayoutGrid className="h-3.5 w-3.5" /> Catalog Management
            </Button>
            {inventoryPath && (
              <Button variant="outline" size="sm" className="gap-1.5" render={<Link href={inventoryPath} />} nativeButton={false}>
                <Boxes className="h-3.5 w-3.5" /> Sales Inventory
              </Button>
            )}
          </div>
        }
      />

      {loading || !stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatWidget icon={Receipt} label="Total Sales" value={formatMoney(stats.totalSales)} accentClassName="text-primary" />
          <StatWidget icon={ShoppingCart} label="Total Purchases" value={formatMoney(stats.totalPurchases)} accentClassName="text-primary" />
          <StatWidget icon={Wallet} label="Outstanding" value={formatMoney(stats.outstandingAmount)} accentClassName="text-amber-500" />
          <StatWidget icon={CircleCheck} label="Paid" value={formatMoney(stats.paidAmount)} accentClassName="text-emerald-500" />
          <StatWidget icon={AlertTriangle} label="Overdue Invoices" value={stats.overdueCount} accentClassName="text-red-500" />
          <StatWidget icon={FileClock} label="Draft Invoices" value={stats.draftCount} accentClassName="text-muted-foreground" />
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recent Invoices</h2>
          <div className="flex items-center gap-2">
            <CreateDocumentMenu basePath={basePath} family="PURCHASE" />
            <CreateDocumentMenu basePath={basePath} family="SALES" />
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-border bg-card h-64 animate-pulse" />
        ) : !stats || stats.recent.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No invoices yet"
            description="Create your first sales or purchase invoice to get started."
          />
        ) : (
          <RecordsTable columns={columns} rows={stats.recent} />
        )}
      </div>
    </div>
  );
}
