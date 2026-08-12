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
  LayoutDashboard,
  Package,
  BarChart3,
  FilePlus2,
  FileSpreadsheet,
  FileMinus2,
  Hash,
  PlusCircle,
  Tags,
  Camera,
  Percent,
  ClipboardList,
  History,
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
import { ModuleCardRow, type ModuleCardDef } from "@/components/invoicing/ModuleCardRow";
import { QuickActionPanel } from "@/components/invoicing/QuickActionPanel";
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
  const [statsError, setStatsError] = useState(false);
  const [periodChoice, setPeriodChoice] = useState<NamedPeriod | "CUSTOM">("THIS_MONTH");
  const [customFrom, setCustomFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const catalogPath = basePath.replace(/\/invoices$/, "/catalog");
  const productPath = basePath.replace(/\/invoices$/, "/product");
  const reportsPath = `${basePath}/reports`;

  const period: DashboardPeriod = useMemo(
    () => (periodChoice === "CUSTOM" ? { from: customFrom, to: customTo } : periodChoice),
    [periodChoice, customFrom, customTo]
  );

  useEffect(() => {
    let cancelled = false;
    getInvoiceDashboardStatsAction(period).then((r) => {
      if (cancelled) return;
      if (r.success) {
        setStats(r.data);
        setStatsError(false);
      } else {
        setStatsError(true);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodChoice, customFrom, customTo]);

  const modules: ModuleCardDef[] = [
    { key: "overview", label: "Overview", description: "Dashboard summary", icon: LayoutDashboard, active: true },
    { key: "sales", label: "Sales", description: "Manage sales invoices", icon: Receipt, href: `${basePath}/sales` },
    { key: "purchases", label: "Purchases", description: "Manage purchase invoices", icon: ShoppingCart, href: `${basePath}/purchase` },
    { key: "expenses", label: "Expenses", description: "Track business expenses", icon: Wallet, href: `${basePath}/expenses` },
    { key: "products", label: "Products", description: "Manage products & inventory", icon: Package, href: productPath },
    { key: "cash-bank", label: "Cash & Bank", description: "Manage cash and bank", icon: Landmark, onClick: () => document.getElementById("cash-bank")?.scrollIntoView({ behavior: "smooth", block: "center" }) },
    { key: "reports", label: "Reports", description: "Insights & analytics", icon: BarChart3, href: reportsPath },
  ];

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
    <div className="space-y-5">
      <PageHeader
        title="Invoice Management"
        description="Track sales and purchase invoices in one place."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={periodChoice} onValueChange={(v) => v && setPeriodChoice(v as NamedPeriod | "CUSTOM")}>
              <SelectTrigger className="w-40">
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

      {periodChoice === "CUSTOM" && (
        <div className="flex items-center gap-2">
          <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-40" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-40" />
        </div>
      )}

      <ModuleCardRow modules={modules} />

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : statsError || !stats ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load statistics" description="Something went wrong fetching your overview. Try refreshing the page." />
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
            <QuickActionPanel
              id="sales"
              icon={Receipt}
              iconClassName="bg-primary/10 text-primary"
              title="Sales"
              description="Create and manage all sales documents"
              viewAllHref={`${basePath}/sales`}
              viewAllLabel="View all sales"
              actions={[
                { label: "Create Tax Invoice", href: `${basePath}/new?type=SALES`, icon: FilePlus2 },
                { label: "Create Quotation", href: `${basePath}/new?type=QUOTATION`, icon: FileSpreadsheet },
                { label: "Create Credit Note", href: `${basePath}/sales/credit-notes`, icon: FileMinus2 },
                { label: "HSN Codes", href: catalogPath, icon: Hash },
              ]}
            />
            <QuickActionPanel
              id="purchases"
              icon={ShoppingCart}
              iconClassName="bg-primary/10 text-primary"
              title="Purchases"
              description="Create and manage all purchase documents"
              viewAllHref={`${basePath}/purchase`}
              viewAllLabel="View all purchases"
              actions={[
                { label: "Create Purchase Invoice", href: `${basePath}/new?type=PURCHASE`, icon: FilePlus2 },
                { label: "Create Debit Note", href: `${basePath}/purchase/debit-notes`, icon: FileMinus2 },
                { label: "HSN Codes", href: catalogPath, icon: Hash },
              ]}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <QuickActionPanel
              id="expenses"
              icon={Wallet}
              iconClassName="bg-violet-500/10 text-violet-500"
              title="Expenses"
              description="Track and manage business expenses"
              viewAllHref={`${basePath}/expenses`}
              viewAllLabel="View all expenses"
              actions={[
                { label: "Add Expense", href: `${basePath}/expenses/new`, icon: PlusCircle },
                { label: "Create Expense Entry", href: `${basePath}/expenses/new`, icon: ClipboardList },
                { label: "Expense Categories", href: `${basePath}/expenses/categories`, icon: Tags },
                { label: "Upload Bill", href: `${basePath}/expenses/new?attach=1`, icon: Camera },
              ]}
            />
            <QuickActionPanel
              icon={Package}
              iconClassName="bg-emerald-500/10 text-emerald-500"
              title="Product Management"
              description="Manage products, categories & inventory"
              actions={[
                { label: "Add Product", href: `${productPath}/new`, icon: PlusCircle },
                { label: "Product Catalog", href: catalogPath, icon: LayoutGrid },
                { label: "Categories", href: catalogPath, icon: Tags },
                { label: "Inventory / Stock", href: inventoryPath ?? productPath, icon: Boxes },
              ]}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <QuickActionPanel
              id="cash-bank"
              icon={Landmark}
              iconClassName="bg-amber-500/10 text-amber-500"
              title="Cash & Bank"
              description="Manage cash flow, bank accounts & transactions"
              actions={[{ label: "View Payment History", href: `${reportsPath}?kind=PAYMENT`, icon: History }]}
              note="A full banking ledger and reconciliation isn't built yet — payments recorded against invoices are tracked in Reports."
            />
            <QuickActionPanel
              icon={BarChart3}
              iconClassName="bg-sky-500/10 text-sky-500"
              title="Reports"
              description="View insights and business reports"
              viewAllHref={reportsPath}
              actions={[
                { label: "Sales Report", href: `${reportsPath}?kind=SALES`, icon: Receipt },
                { label: "Purchase Report", href: `${reportsPath}?kind=PURCHASE`, icon: ShoppingCart },
                { label: "Expense Report", href: `${reportsPath}?kind=EXPENSE`, icon: Wallet },
                { label: "GST / Tax Report", href: `${reportsPath}?kind=GST_SUMMARY`, icon: Percent },
              ]}
            />
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

      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 to-card p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Everything in one place</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Create, track, and manage your sales, purchases, expenses, and reports seamlessly.</p>
        </div>
        <Link href={reportsPath} className="text-xs font-medium text-primary hover:underline flex items-center gap-1 shrink-0">
          Explore all features <ArrowRight className="h-3.5 w-3.5" />
        </Link>
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
