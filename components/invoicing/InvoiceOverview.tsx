"use client";

import { useEffect, useMemo, useState } from "react";
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
  Landmark,
  CreditCard,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatWidget } from "@/components/portal/stat-widget";
import { StatusBadge } from "@/components/portal/status-badge";
import { RecordsTable, type RecordColumn } from "@/components/portal/records-table";
import { EmptyState } from "@/components/shared/empty-state";
import { CreateDocumentMenu } from "@/components/invoicing/CreateDocumentMenu";
import { DualSeriesLineChart } from "@/components/invoicing/charts/DualSeriesLineChart";
import { CategoryBarChart } from "@/components/invoicing/charts/CategoryBarChart";
import { getInvoiceDashboardStatsAction } from "@/services/invoicing";
import { INVOICE_STATUS_LABELS, INVOICE_TYPE_LABELS, formatMoney, formatShortDate } from "@/lib/invoicing/ui";
import { PERIOD_LABELS, type NamedPeriod, type DashboardPeriod } from "@/lib/invoicing/period";
import type { InvoiceDashboardStats, InvoiceSummary } from "@/types/invoicing";

const NAMED_PERIODS: NamedPeriod[] = ["THIS_MONTH", "LAST_MONTH", "THIS_QUARTER", "THIS_YEAR"];

export function InvoiceOverview({ basePath, inventoryPath }: { basePath: string; inventoryPath?: string }) {
  const [stats, setStats] = useState<InvoiceDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodChoice, setPeriodChoice] = useState<NamedPeriod | "CUSTOM">("THIS_MONTH");
  const [customFrom, setCustomFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const catalogPath = basePath.replace(/\/invoices$/, "/catalog");

  const period: DashboardPeriod = useMemo(
    () => (periodChoice === "CUSTOM" ? { from: customFrom, to: customTo } : periodChoice),
    [periodChoice, customFrom, customTo]
  );

  useEffect(() => {
    let cancelled = false;
    getInvoiceDashboardStatsAction(period).then((r) => {
      if (cancelled) return;
      if (r.success) setStats(r.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodChoice, customFrom, customTo]);

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

      <div className="flex flex-wrap items-center gap-2">
        <Select value={periodChoice} onValueChange={(v) => v && setPeriodChoice(v as NamedPeriod | "CUSTOM")}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NAMED_PERIODS.map((p) => (
              <SelectItem key={p} value={p}>
                {PERIOD_LABELS[p]}
              </SelectItem>
            ))}
            <SelectItem value="CUSTOM">Custom Range</SelectItem>
          </SelectContent>
        </Select>
        {periodChoice === "CUSTOM" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-40" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-40" />
          </div>
        )}
      </div>

      {loading || !stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatWidget icon={Receipt} label="Total Sales" value={formatMoney(stats.totalSales)} accentClassName="text-primary" />
            <StatWidget icon={ShoppingCart} label="Total Purchases" value={formatMoney(stats.totalPurchases)} accentClassName="text-primary" />
            <StatWidget icon={Landmark} label="Receivables" value={formatMoney(stats.receivables)} accentClassName="text-amber-500" />
            <StatWidget icon={CreditCard} label="Payables" value={formatMoney(stats.payables)} accentClassName="text-amber-500" />
            <StatWidget icon={CircleCheck} label="Paid" value={formatMoney(stats.paidAmount)} accentClassName="text-emerald-500" />
            <StatWidget icon={AlertTriangle} label="Overdue Invoices" value={stats.overdueCount} accentClassName="text-red-500" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatWidget icon={AlertTriangle} label="Overdue Receivable" value={formatMoney(stats.overdueReceivable)} accentClassName="text-red-500" />
            <StatWidget icon={AlertTriangle} label="Overdue Payable" value={formatMoney(stats.overduePayable)} accentClassName="text-red-500" />
            <StatWidget icon={Wallet} label="Total Expenses" value={formatMoney(stats.totalExpenses)} accentClassName="text-violet-500" />
            <StatWidget icon={FileClock} label="Draft Invoices" value={stats.draftCount} accentClassName="text-muted-foreground" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-1">Sales</h2>
              <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                <SummaryRow label="Invoiced" value={formatMoney(stats.salesSummary.invoiced)} />
                <SummaryRow label="Received" value={formatMoney(stats.salesSummary.received)} />
                <SummaryRow label="Outstanding" value={formatMoney(stats.salesSummary.outstanding)} />
                <SummaryRow label="Overdue" value={formatMoney(stats.salesSummary.overdue)} />
                <SummaryRow label="Credit Notes" value={formatMoney(stats.salesSummary.creditNotes)} />
                <SummaryRow label="Sales Returns" value={formatMoney(stats.salesSummary.salesReturns)} />
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-1">Purchases</h2>
              <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                <SummaryRow label="Purchased" value={formatMoney(stats.purchaseSummary.purchased)} />
                <SummaryRow label="Paid" value={formatMoney(stats.purchaseSummary.paid)} />
                <SummaryRow label="Outstanding" value={formatMoney(stats.purchaseSummary.outstanding)} />
                <SummaryRow label="Debit Notes" value={formatMoney(stats.purchaseSummary.debitNotes)} />
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">Sales vs Purchases</h2>
              <DualSeriesLineChart
                points={stats.chartSalesVsPurchase.map((p) => ({ label: p.label, a: Number(p.sales), b: Number(p.purchases) }))}
                seriesALabel="Sales"
                seriesBLabel="Purchases"
              />
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">Payments Received vs Paid</h2>
              <DualSeriesLineChart
                points={stats.chartPaymentsOverTime.map((p) => ({ label: p.label, a: Number(p.received), b: Number(p.paid) }))}
                seriesALabel="Received"
                seriesBLabel="Paid"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Expenses by Category</h2>
            <CategoryBarChart data={stats.chartExpensesByCategory} />
          </div>
        </>
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="text-foreground font-medium tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
