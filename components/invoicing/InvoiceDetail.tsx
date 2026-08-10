"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Copy, Archive, FileMinus, Undo2, FileX2, ArrowRightLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusChangeMenu } from "./StatusChangeMenu";
import { InvoicePreview } from "./preview/InvoicePreview";
import { RelatedDocuments } from "./RelatedDocuments";
import { duplicateInvoiceAction, archiveInvoiceAction, getRelatedDocumentsAction } from "@/services/invoicing";
import { formatDateTime } from "@/lib/invoicing/ui";
import { invoiceFamily } from "@/lib/invoicing/family";
import type { InvoiceRecord, RelatedDocuments as RelatedDocumentsData } from "@/types/invoicing";
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

  useEffect(() => {
    getRelatedDocumentsAction(invoice.id).then((r) => {
      if (r.success) setRelated(r.data);
    });
  }, [invoice.id]);

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
              <StatusChangeMenu invoiceId={invoice.id} currentStatus={status} onChanged={setStatus} />
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

      <div className="grid sm:grid-cols-3 gap-3 text-xs">
        <Meta label="Created By" value={invoice.sellerName} />
        <Meta label="Created At" value={formatDateTime(invoice.createdAt)} />
        <Meta label="Updated At" value={formatDateTime(invoice.updatedAt)} />
      </div>

      {related && <RelatedDocuments basePath={basePath} data={related} />}

      <InvoicePreview
        type={invoice.type}
        status={status}
        invoiceNumber={invoice.invoiceNumber}
        invoiceDate={invoice.invoiceDate}
        dueDate={invoice.dueDate}
        currency={invoice.currency}
        paymentTerms={invoice.paymentTerms}
        referenceNumber={invoice.referenceNumber}
        sellerName={invoice.sellerName}
        sellerAddress={invoice.sellerAddress}
        sellerTaxId={invoice.sellerTaxId}
        sellerPhone={invoice.sellerPhone}
        sellerEmail={invoice.sellerEmail}
        sellerLogoUrl={invoice.sellerLogoUrl}
        partyName={invoice.partyName}
        partyContactPerson={invoice.partyContactPerson}
        partyEmail={invoice.partyEmail}
        partyPhone={invoice.partyPhone}
        partyBillingAddress={invoice.partyBillingAddress}
        partyShippingAddress={invoice.partyShippingAddress}
        partyTaxId={invoice.partyTaxId}
        taxMode={invoice.taxMode}
        taxBreakup={invoice.taxBreakup}
        items={invoice.items.map((it) => ({
          productName: it.productName,
          description: it.description,
          hsnSac: it.hsnSac,
          quantity: it.quantity,
          unit: it.unit,
          rate: it.rate,
          discountPercent: it.discountPercent,
          taxPercent: it.taxPercent,
          taxAmount: it.taxAmount,
          lineTotal: it.lineTotal,
        }))}
        totals={{
          subtotal: invoice.subtotal,
          itemDiscountTotal: invoice.itemDiscountTotal,
          taxableAmount: invoice.taxableAmount,
          cgstTotal: invoice.cgstTotal,
          sgstTotal: invoice.sgstTotal,
          igstTotal: invoice.igstTotal,
          taxTotal: invoice.taxTotal,
          shippingCharge: invoice.shippingCharge,
          miscCharge: invoice.miscCharge,
          additionalDiscount: invoice.additionalDiscount,
          roundOff: invoice.roundOff,
          grandTotal: invoice.grandTotal,
        }}
        miscChargeLabel={invoice.miscChargeLabel}
        customerNotes={invoice.customerNotes}
        termsAndConditions={invoice.termsAndConditions}
      />
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
