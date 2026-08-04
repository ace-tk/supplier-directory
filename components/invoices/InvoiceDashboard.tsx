"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Copy,
  Download,
  Printer,
  Mail,
  Receipt,
  ShoppingCart,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/portal/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { PurchaseInvoiceDialog } from "@/components/invoices/PurchaseInvoiceDialog";
import { SalesInvoiceDialog } from "@/components/invoices/SalesInvoiceDialog";
import {
  getPurchaseInvoicesAction,
  getSalesInvoicesAction,
  deletePurchaseInvoiceAction,
  deleteSalesInvoiceAction,
  duplicatePurchaseInvoiceAction,
  duplicateSalesInvoiceAction,
  emailPurchaseInvoiceAction,
  emailSalesInvoiceAction,
} from "@/services/invoices";
import { downloadPurchaseInvoicePdf, downloadSalesInvoicePdf, printPurchaseInvoice, printSalesInvoice } from "@/lib/invoice-pdf";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_OPTIONS, formatShortDate, formatMoney } from "@/lib/invoice-ui";
import type { PurchaseInvoiceRecord, SalesInvoiceRecord } from "@/types/invoice";

type Section = "PURCHASE" | "SALES";

export function InvoiceDashboard() {
  const [section, setSection] = useState<Section>("PURCHASE");
  const [purchases, setPurchases] = useState<PurchaseInvoiceRecord[]>([]);
  const [sales, setSales] = useState<SalesInvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [purchaseTarget, setPurchaseTarget] = useState<PurchaseInvoiceRecord | null>(null);
  const [salesDialogOpen, setSalesDialogOpen] = useState(false);
  const [salesTarget, setSalesTarget] = useState<SalesInvoiceRecord | null>(null);

  const [deletePurchase, setDeletePurchase] = useState<PurchaseInvoiceRecord | null>(null);
  const [deleteSales, setDeleteSales] = useState<SalesInvoiceRecord | null>(null);

  function refresh() {
    Promise.all([getPurchaseInvoicesAction(), getSalesInvoicesAction()]).then(([p, s]) => {
      if (p.success) setPurchases(p.data);
      if (s.success) setSales(s.data);
      setLoading(false);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((inv) => {
      if (statusFilter !== "All" && inv.status !== statusFilter) return false;
      if (search && !inv.vendor.toLowerCase().includes(search.toLowerCase()) && !inv.invoiceNumber.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [purchases, search, statusFilter]);

  const filteredSales = useMemo(() => {
    return sales.filter((inv) => {
      if (statusFilter !== "All" && inv.paymentStatus !== statusFilter) return false;
      if (search && !inv.customer.toLowerCase().includes(search.toLowerCase()) && !inv.invoiceNumber.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [sales, search, statusFilter]);

  async function handleDeletePurchase() {
    if (!deletePurchase) return;
    const result = await deletePurchaseInvoiceAction(deletePurchase.id);
    if (!result.success) return toast.error(result.error);
    toast.success("Purchase invoice deleted");
    setDeletePurchase(null);
    refresh();
  }

  async function handleDeleteSales() {
    if (!deleteSales) return;
    const result = await deleteSalesInvoiceAction(deleteSales.id);
    if (!result.success) return toast.error(result.error);
    toast.success("Sales invoice deleted");
    setDeleteSales(null);
    refresh();
  }

  async function handleDuplicatePurchase(inv: PurchaseInvoiceRecord) {
    const result = await duplicatePurchaseInvoiceAction(inv.id);
    if (!result.success) return toast.error(result.error);
    toast.success("Invoice duplicated");
    refresh();
  }

  async function handleDuplicateSales(inv: SalesInvoiceRecord) {
    const result = await duplicateSalesInvoiceAction(inv.id);
    if (!result.success) return toast.error(result.error);
    toast.success("Invoice duplicated");
    refresh();
  }

  async function handleEmailPurchase(inv: PurchaseInvoiceRecord) {
    const result = await emailPurchaseInvoiceAction(inv.id);
    if (!result.success) return toast.error(result.error);
    toast.success(`Invoice emailed to ${inv.vendor}`);
    refresh();
  }

  async function handleEmailSales(inv: SalesInvoiceRecord) {
    const result = await emailSalesInvoiceAction(inv.id);
    if (!result.success) return toast.error(result.error);
    toast.success(`Invoice emailed to ${inv.customer}`);
    refresh();
  }

  const purchaseColumns: RecordColumn<PurchaseInvoiceRecord>[] = [
    { key: "vendor", label: "Vendor", render: (i) => <span className="font-medium text-foreground">{i.vendor}</span> },
    { key: "invoiceNumber", label: "Invoice #", render: (i) => i.invoiceNumber },
    { key: "invoiceDate", label: "Invoice Date", render: (i) => formatShortDate(i.invoiceDate) },
    { key: "dueDate", label: "Due Date", render: (i) => formatShortDate(i.dueDate) },
    { key: "totalAmount", label: "Total", render: (i) => <span className="tabular-nums">{formatMoney(i.totalAmount)}</span> },
    { key: "status", label: "Status", render: (i) => <StatusBadge status={INVOICE_STATUS_LABELS[i.status]} /> },
    {
      key: "actions",
      label: "",
      render: (i) => (
        <div className="flex items-center gap-0.5 justify-end">
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Edit" onClick={() => { setPurchaseTarget(i); setPurchaseDialogOpen(true); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Duplicate" onClick={() => handleDuplicatePurchase(i)}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Download PDF" onClick={() => downloadPurchaseInvoicePdf(i)}>
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Print" onClick={() => printPurchaseInvoice(i)}>
            <Printer className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Email invoice" onClick={() => handleEmailPurchase(i)}>
            <Mail className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" aria-label="Delete" onClick={() => setDeletePurchase(i)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  const salesColumns: RecordColumn<SalesInvoiceRecord>[] = [
    { key: "customer", label: "Customer", render: (i) => <span className="font-medium text-foreground">{i.customer}</span> },
    { key: "invoiceNumber", label: "Invoice #", render: (i) => i.invoiceNumber },
    { key: "invoiceDate", label: "Invoice Date", render: (i) => formatShortDate(i.invoiceDate) },
    { key: "dueDate", label: "Due Date", render: (i) => formatShortDate(i.dueDate) },
    { key: "grandTotal", label: "Grand Total", render: (i) => <span className="tabular-nums">{formatMoney(i.grandTotal)}</span> },
    { key: "paymentStatus", label: "Payment Status", render: (i) => <StatusBadge status={INVOICE_STATUS_LABELS[i.paymentStatus]} /> },
    {
      key: "actions",
      label: "",
      render: (i) => (
        <div className="flex items-center gap-0.5 justify-end">
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Edit" onClick={() => { setSalesTarget(i); setSalesDialogOpen(true); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Duplicate" onClick={() => handleDuplicateSales(i)}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Download PDF" onClick={() => downloadSalesInvoicePdf(i)}>
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Print" onClick={() => printSalesInvoice(i)}>
            <Printer className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Email invoice" onClick={() => handleEmailSales(i)}>
            <Mail className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" aria-label="Delete" onClick={() => setDeleteSales(i)}>
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
        title="Invoice Management"
        description="Track purchase and sales invoices in one place."
        actions={
          section === "PURCHASE" ? (
            <Button className="gap-1.5" onClick={() => { setPurchaseTarget(null); setPurchaseDialogOpen(true); }}>
              <Plus className="h-4 w-4" /> Create Invoice
            </Button>
          ) : (
            <Button className="gap-1.5" onClick={() => { setSalesTarget(null); setSalesDialogOpen(true); }}>
              <Plus className="h-4 w-4" /> Create Invoice
            </Button>
          )
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <Tabs value={section} onValueChange={(v) => v && setSection(v as Section)}>
          <TabsList>
            <TabsTrigger value="PURCHASE" className="gap-1.5"><ShoppingCart className="h-3.5 w-3.5" /> Purchase Management</TabsTrigger>
            <TabsTrigger value="SALES" className="gap-1.5"><Receipt className="h-3.5 w-3.5" /> Sales Management</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoices..." className="pl-8 w-48" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Status</SelectItem>
              {INVOICE_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{INVOICE_STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card h-64 animate-pulse" />
      ) : section === "PURCHASE" ? (
        filteredPurchases.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title={purchases.length === 0 ? "No purchase invoices yet" : "No invoices match your filters"}
            description={purchases.length === 0 ? "Create your first purchase invoice to start tracking incoming purchases." : "Try adjusting your search or filters."}
            action={purchases.length === 0 ? { label: "Create Invoice", onClick: () => { setPurchaseTarget(null); setPurchaseDialogOpen(true); } } : undefined}
          />
        ) : (
          <RecordsTable columns={purchaseColumns} rows={filteredPurchases} />
        )
      ) : filteredSales.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={sales.length === 0 ? "No sales invoices yet" : "No invoices match your filters"}
          description={sales.length === 0 ? "Create your first sales invoice to start tracking outgoing sales." : "Try adjusting your search or filters."}
          action={sales.length === 0 ? { label: "Create Invoice", onClick: () => { setSalesTarget(null); setSalesDialogOpen(true); } } : undefined}
        />
      ) : (
        <RecordsTable columns={salesColumns} rows={filteredSales} />
      )}

      <PurchaseInvoiceDialog invoice={purchaseTarget} open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen} onSaved={refresh} />
      <SalesInvoiceDialog invoice={salesTarget} open={salesDialogOpen} onOpenChange={setSalesDialogOpen} onSaved={refresh} />

      <AlertDialog open={!!deletePurchase} onOpenChange={(open) => !open && setDeletePurchase(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this invoice?</AlertDialogTitle>
            <AlertDialogDescription>Invoice {deletePurchase?.invoiceNumber} from {deletePurchase?.vendor} will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePurchase}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteSales} onOpenChange={(open) => !open && setDeleteSales(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this invoice?</AlertDialogTitle>
            <AlertDialogDescription>Invoice {deleteSales?.invoiceNumber} for {deleteSales?.customer} will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSales}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
