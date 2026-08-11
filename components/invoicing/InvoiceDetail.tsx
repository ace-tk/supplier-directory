"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Copy, Archive, FileMinus, Undo2, FileX2, ArrowRightLeft, Download, Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusChangeMenu } from "./StatusChangeMenu";
import { InvoicePreview, toInvoicePreviewProps } from "./preview/InvoicePreview";
import { RelatedDocuments } from "./RelatedDocuments";
import { ShareMenu } from "./ShareMenu";
import { ActivityTimeline } from "./ActivityTimeline";
import { RecordPaymentDialog } from "./payments/RecordPaymentDialog";
import { PaymentHistory } from "./payments/PaymentHistory";
import { PaymentTimeline } from "./payments/PaymentTimeline";
import { SendReminderDialog } from "./payments/SendReminderDialog";
import {
  duplicateInvoiceAction,
  archiveInvoiceAction,
  getRelatedDocumentsAction,
  getInvoiceActivityAction,
} from "@/services/invoicing";
import { listPaymentsForInvoiceAction } from "@/services/payments";
import { formatDateTime, formatMoney } from "@/lib/invoicing/ui";
import { invoiceFamily } from "@/lib/invoicing/family";
import { computeInvoicePaymentSummary } from "@/lib/invoicing/payments";
import type {
  InvoiceRecord,
  RelatedDocuments as RelatedDocumentsData,
  PaymentRecord,
  InvoiceActivityRecord,
} from "@/types/invoicing";
import type { InvoiceAccess } from "@/lib/invoicing/permissions";

export function InvoiceDetail({
  basePath,
  invoice,
  access,
}: {
  basePath: string;
  invoice: InvoiceRecord;
  access: InvoiceAccess;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(invoice.status);
  const [archiving, setArchiving] = useState(false);
  const [related, setRelated] = useState<RelatedDocumentsData | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[] | null>(null);
  const [activity, setActivity] = useState<InvoiceActivityRecord[] | null>(null);
  const acceptsPayments = invoice.type === "SALES" || invoice.type === "PURCHASE";

  useEffect(() => {
    getRelatedDocumentsAction(invoice.id).then((r) => {
      if (r.success) setRelated(r.data);
    });
    getInvoiceActivityAction(invoice.id).then((r) => {
      if (r.success) setActivity(r.data);
    });
  }, [invoice.id]);

  useEffect(() => {
    if (!acceptsPayments) return;
    listPaymentsForInvoiceAction(invoice.id).then((r) => {
      if (r.success) setPayments(r.data);
    });
  }, [invoice.id, acceptsPayments]);

  const paymentSummary = computeInvoicePaymentSummary(invoice.grandTotal, payments ?? []);

  function handlePaymentRecorded(payment: PaymentRecord) {
    const next = [payment, ...(payments ?? [])];
    setPayments(next);
    const summary = computeInvoicePaymentSummary(invoice.grandTotal, next);
    setStatus(summary.isFullyPaid ? "PAID" : summary.isPartiallyPaid ? "PARTIALLY_PAID" : status);
  }

  const [downloading, setDownloading] = useState(false);
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      const { downloadInvoicePdf } = await import("@/lib/invoicing/pdf");
      downloadInvoicePdf(toInvoicePreviewProps(invoice, status));
    } finally {
      setDownloading(false);
    }
  }

  function handlePrint() {
    window.open(`/invoices/${invoice.id}/print`, "_blank", "noopener,noreferrer");
  }

  async function handleDuplicate() {
    const result = await duplicateInvoiceAction(invoice.id);
    if (!result.success) return toast.error(result.error);
    toast.success("Invoice duplicated");
    router.push(`${basePath}/${result.data.id}/edit`);
  }

  async function handleArchive() {
    setArchiving(true);
    const result = await archiveInvoiceAction(invoice.id);
    setArchiving(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Invoice archived");
    router.push(basePath);
    router.refresh();
  }

  const family = invoiceFamily(invoice.type);
  const listPath = `${basePath}/${family.toLowerCase()}`;

  // Convert-to-Tax-Invoice is only offered on a Quotation, and only once —
  // if a Tax Invoice has already been derived from this quotation, link to
  // it instead of allowing another (accidental-duplicate-conversion guard).
  const existingConversion = related?.derived.find((d) => d.type === "SALES");

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={invoice.invoiceNumber}
        breadcrumbs={[
          { label: "Invoice Management", href: basePath },
          { label: family === "SALES" ? "Sales" : "Purchase", href: listPath },
          { label: invoice.invoiceNumber },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button variant="outline" size="sm" className="gap-1.5" render={<Link href={listPath} />} nativeButton={false}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            {access.canEdit && invoice.status === "DRAFT" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                render={<Link href={`${basePath}/${invoice.id}/edit`} />}
                nativeButton={false}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
            {access.canDuplicate && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDuplicate}>
                <Copy className="h-3.5 w-3.5" /> Duplicate
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadPdf} disabled={downloading}>
              <Download className="h-3.5 w-3.5" /> Download PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
            {access.isOwner && <ShareMenu invoice={invoice} url={shareUrl} />}

            {/* Per-exact-type gating — never generic to the whole family. */}
            {access.isOwner && invoice.type === "SALES" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  render={<Link href={`${basePath}/new?type=CREDIT_NOTE&source=${invoice.id}`} />}
                  nativeButton={false}
                >
                  <FileMinus className="h-3.5 w-3.5" /> Create Credit Note
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  render={<Link href={`${basePath}/new?type=SALES_RETURN&source=${invoice.id}`} />}
                  nativeButton={false}
                >
                  <Undo2 className="h-3.5 w-3.5" /> Create Sales Return
                </Button>
              </>
            )}
            {access.isOwner && invoice.type === "PURCHASE" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                render={<Link href={`${basePath}/new?type=DEBIT_NOTE&source=${invoice.id}`} />}
                nativeButton={false}
              >
                <FileX2 className="h-3.5 w-3.5" /> Create Debit Note
              </Button>
            )}
            {access.isOwner && invoice.type === "QUOTATION" && (
              existingConversion ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  render={<Link href={`${basePath}/${existingConversion.id}`} />}
                  nativeButton={false}
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" /> View Tax Invoice
                </Button>
              ) : (
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <ArrowRightLeft className="h-3.5 w-3.5" /> Convert to Tax Invoice
                    </Button>
                  }
                  title="Convert this quotation to a Tax Invoice?"
                  description="This creates a new Tax Invoice pre-filled from this quotation. You can review and edit everything before saving it."
                  confirmLabel="Continue"
                  onConfirm={() => router.push(`${basePath}/new?type=SALES&source=${invoice.id}`)}
                />
              )
            )}

            {access.canChangeStatus && (
              <StatusChangeMenu invoiceId={invoice.id} invoiceType={invoice.type} currentStatus={status} onChanged={setStatus} />
            )}
            {access.canArchive && !invoice.archivedAt && (
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                disabled={archiving}
                onClick={handleArchive}
              >
                <Archive className="h-3.5 w-3.5" /> Archive
              </Button>
            )}
          </div>
        }
      />

      <Tabs defaultValue="document">
        <TabsList>
          <TabsTrigger value="document">Document</TabsTrigger>
          {acceptsPayments && <TabsTrigger value="payments">Payments</TabsTrigger>}
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="related">Related Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="document" className="space-y-6 pt-4">
          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            <Meta label="Created By" value={invoice.sellerName} />
            <Meta label="Created At" value={formatDateTime(invoice.createdAt)} />
            <Meta label="Updated At" value={formatDateTime(invoice.updatedAt)} />
          </div>
          <InvoicePreview {...toInvoicePreviewProps(invoice, status)} />
        </TabsContent>

        {acceptsPayments && (
          <TabsContent value="payments" className="pt-4">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-sm font-semibold text-foreground">Payments</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  {access.isOwner && invoice.type === "SALES" && !paymentSummary.isFullyPaid && Number(paymentSummary.balanceDue) > 0 && (
                    <SendReminderDialog invoice={invoice} balanceDue={paymentSummary.balanceDue} />
                  )}
                  {access.isOwner && (
                    <RecordPaymentDialog
                      invoiceId={invoice.id}
                      currency={invoice.currency}
                      balanceDue={paymentSummary.balanceDue}
                      onRecorded={handlePaymentRecorded}
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <Meta label="Invoice Total" value={formatMoney(invoice.grandTotal, invoice.currency)} />
                <Meta label="Amount Paid" value={formatMoney(paymentSummary.amountPaid, invoice.currency)} />
                <Meta label="Balance Due" value={formatMoney(paymentSummary.balanceDue, invoice.currency)} />
              </div>

              <PaymentHistory payments={payments ?? []} currency={invoice.currency} />

              {payments && payments.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <h3 className="text-xs font-semibold text-foreground mb-3">Timeline</h3>
                  <PaymentTimeline
                    createdAt={invoice.createdAt}
                    payments={payments}
                    currency={invoice.currency}
                    isFullyPaid={paymentSummary.isFullyPaid}
                  />
                </div>
              )}
            </div>
          </TabsContent>
        )}

        <TabsContent value="activity" className="pt-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <ActivityTimeline activity={activity ?? []} />
          </div>
        </TabsContent>

        <TabsContent value="related" className="pt-4">
          {related ? (
            <RelatedDocuments basePath={basePath} data={related} />
          ) : (
            <p className="text-xs text-muted-foreground py-4 text-center">Loading…</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-muted-foreground">{label}</p>
      <p className="text-foreground font-medium mt-0.5">{value}</p>
    </div>
  );
}
