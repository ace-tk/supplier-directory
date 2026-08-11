import type { InvoiceType, InvoiceStatus, InvoiceTaxMode, InvoiceTaxBreakup, InvoiceRecord } from "@/types/invoicing";
import { formatMoney, formatQuantity, formatShortDate, INVOICE_STATUS_LABELS, INVOICE_TYPE_LABELS } from "@/lib/invoicing/ui";
import { invoiceFamily } from "@/lib/invoicing/family";
import { StatusBadge } from "@/components/portal/status-badge";

export interface InvoicePreviewItem {
  productName: string;
  description?: string | null;
  hsnSac?: string | null;
  quantity: string | number;
  unit: string;
  rate: string | number;
  discountPercent?: string | number;
  taxPercent?: string | number;
  taxAmount: string;
  lineTotal: string;
}

export interface InvoicePreviewTotals {
  subtotal: string;
  itemDiscountTotal: string;
  taxableAmount: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  taxTotal: string;
  shippingCharge: string;
  miscCharge: string;
  additionalDiscount: string;
  roundOff: string;
  grandTotal: string;
}

export interface InvoicePreviewProps {
  type: InvoiceType;
  status?: InvoiceStatus;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  paymentTerms?: string | null;
  referenceNumber?: string | null;

  sellerName: string;
  sellerAddress?: string | null;
  sellerTaxId?: string | null;
  sellerPhone?: string | null;
  sellerEmail?: string | null;
  sellerLogoUrl?: string | null;

  partyName: string;
  partyContactPerson?: string | null;
  partyEmail?: string | null;
  partyPhone?: string | null;
  partyBillingAddress?: string | null;
  partyShippingAddress?: string | null;
  partyTaxId?: string | null;

  taxMode: InvoiceTaxMode;
  taxBreakup: InvoiceTaxBreakup;

  items: InvoicePreviewItem[];
  totals: InvoicePreviewTotals;
  miscChargeLabel?: string | null;

  customerNotes?: string | null;
  termsAndConditions?: string | null;

  className?: string;
}

/**
 * The single source of truth for turning a persisted InvoiceRecord into
 * InvoicePreviewProps — used by the on-screen preview, the PDF builder, and
 * the print route, so all three can never disagree on what an invoice says.
 */
export function toInvoicePreviewProps(invoice: InvoiceRecord, status: InvoiceStatus = invoice.status): InvoicePreviewProps {
  return {
    type: invoice.type,
    status,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    paymentTerms: invoice.paymentTerms,
    referenceNumber: invoice.referenceNumber,
    sellerName: invoice.sellerName,
    sellerAddress: invoice.sellerAddress,
    sellerTaxId: invoice.sellerTaxId,
    sellerPhone: invoice.sellerPhone,
    sellerEmail: invoice.sellerEmail,
    sellerLogoUrl: invoice.sellerLogoUrl,
    partyName: invoice.partyName,
    partyContactPerson: invoice.partyContactPerson,
    partyEmail: invoice.partyEmail,
    partyPhone: invoice.partyPhone,
    partyBillingAddress: invoice.partyBillingAddress,
    partyShippingAddress: invoice.partyShippingAddress,
    partyTaxId: invoice.partyTaxId,
    taxMode: invoice.taxMode,
    taxBreakup: invoice.taxBreakup,
    items: invoice.items.map((it) => ({
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
    })),
    totals: {
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
    },
    miscChargeLabel: invoice.miscChargeLabel,
    customerNotes: invoice.customerNotes,
    termsAndConditions: invoice.termsAndConditions,
  };
}

function isoOrRaw(date: string): string {
  // Accept both plain yyyy-mm-dd (from a form input) and full ISO strings.
  if (!date) return "—";
  const iso = date.length === 10 ? `${date}T00:00:00.000Z` : date;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : formatShortDate(d.toISOString());
}

export function InvoicePreview(props: InvoicePreviewProps) {
  const {
    type,
    status,
    invoiceNumber,
    invoiceDate,
    dueDate,
    currency,
    paymentTerms,
    referenceNumber,
    sellerName,
    sellerAddress,
    sellerTaxId,
    sellerPhone,
    sellerEmail,
    sellerLogoUrl,
    partyName,
    partyContactPerson,
    partyEmail,
    partyPhone,
    partyBillingAddress,
    partyShippingAddress,
    partyTaxId,
    taxBreakup,
    items,
    totals,
    miscChargeLabel,
    customerNotes,
    termsAndConditions,
    className,
  } = props;

  const money = (v: string) => formatMoney(v, currency);
  const partyLabel = invoiceFamily(type) === "SALES" ? "Bill To" : "Bill From";

  return (
    <div className={`rounded-2xl border border-border bg-card shadow-card overflow-hidden ${className ?? ""}`}>
      <div className="p-6 sm:p-8 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            {sellerLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sellerLogoUrl} alt="" className="h-12 w-12 rounded-lg object-cover border border-border" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                {sellerName?.charAt(0)?.toUpperCase() || "S"}
              </div>
            )}
            <div>
              <p className="font-semibold text-foreground text-base leading-tight">{sellerName || "Your Company"}</p>
              {sellerAddress && <p className="text-xs text-muted-foreground whitespace-pre-line max-w-xs mt-0.5">{sellerAddress}</p>}
              <div className="text-xs text-muted-foreground mt-0.5 space-x-2">
                {sellerEmail && <span>{sellerEmail}</span>}
                {sellerPhone && <span>{sellerPhone}</span>}
              </div>
              {sellerTaxId && <p className="text-xs text-muted-foreground mt-0.5">GSTIN: {sellerTaxId}</p>}
            </div>
          </div>

          <div className="text-right space-y-1.5">
            <p className="text-lg font-semibold text-foreground tracking-tight">{INVOICE_TYPE_LABELS[type]}</p>
            <p className="text-sm font-mono text-muted-foreground">{invoiceNumber || "—"}</p>
            {status && <div className="flex justify-end"><StatusBadge status={INVOICE_STATUS_LABELS[status]} /></div>}
          </div>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-muted-foreground">Invoice Date</p>
            <p className="text-foreground font-medium mt-0.5">{isoOrRaw(invoiceDate)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Due Date</p>
            <p className="text-foreground font-medium mt-0.5">{isoOrRaw(dueDate)}</p>
          </div>
          {paymentTerms && (
            <div>
              <p className="text-muted-foreground">Payment Terms</p>
              <p className="text-foreground font-medium mt-0.5">{paymentTerms}</p>
            </div>
          )}
          {referenceNumber && (
            <div>
              <p className="text-muted-foreground">Reference / PO</p>
              <p className="text-foreground font-medium mt-0.5">{referenceNumber}</p>
            </div>
          )}
        </div>

        {/* Party */}
        <div className="rounded-xl bg-muted/40 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">{partyLabel}</p>
          <p className="font-medium text-foreground text-sm">{partyName || "—"}</p>
          {partyContactPerson && <p className="text-xs text-muted-foreground mt-0.5">Attn: {partyContactPerson}</p>}
          <div className="text-xs text-muted-foreground mt-0.5 space-x-2">
            {partyEmail && <span>{partyEmail}</span>}
            {partyPhone && <span>{partyPhone}</span>}
          </div>
          {partyTaxId && <p className="text-xs text-muted-foreground mt-0.5">GSTIN: {partyTaxId}</p>}
          {partyBillingAddress && (
            <p className="text-xs text-muted-foreground whitespace-pre-line mt-1.5">
              <span className="text-foreground/70">Billing: </span>
              {partyBillingAddress}
            </p>
          )}
          {partyShippingAddress && (
            <p className="text-xs text-muted-foreground whitespace-pre-line mt-1">
              <span className="text-foreground/70">Shipping: </span>
              {partyShippingAddress}
            </p>
          )}
        </div>

        {/* Items */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="text-left font-medium px-3 py-2">Item</th>
                  <th className="text-right font-medium px-3 py-2">Qty</th>
                  <th className="text-right font-medium px-3 py-2">Rate</th>
                  <th className="text-right font-medium px-3 py-2">Disc%</th>
                  <th className="text-right font-medium px-3 py-2">Tax%</th>
                  <th className="text-right font-medium px-3 py-2">Tax Amt</th>
                  <th className="text-right font-medium px-3 py-2">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-muted-foreground">
                      No items added yet
                    </td>
                  </tr>
                ) : (
                  items.map((item, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 align-top">
                        <p className="text-foreground font-medium">{item.productName || "Untitled item"}</p>
                        {item.description && <p className="text-muted-foreground mt-0.5">{item.description}</p>}
                        {item.hsnSac && <p className="text-muted-foreground/70 mt-0.5">HSN/SAC: {item.hsnSac}</p>}
                      </td>
                      <td className="px-3 py-2 text-right align-top tabular-nums">
                        {formatQuantity(item.quantity)} {item.unit}
                      </td>
                      <td className="px-3 py-2 text-right align-top tabular-nums">{money(String(item.rate))}</td>
                      <td className="px-3 py-2 text-right align-top tabular-nums">
                        {item.discountPercent ? `${item.discountPercent}%` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right align-top tabular-nums">{item.taxPercent ? `${item.taxPercent}%` : "—"}</td>
                      <td className="px-3 py-2 text-right align-top tabular-nums">{money(item.taxAmount)}</td>
                      <td className="px-3 py-2 text-right align-top tabular-nums font-medium text-foreground">
                        {money(item.lineTotal)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full sm:w-80 space-y-1.5 text-xs">
            <Row label="Subtotal" value={money(totals.subtotal)} />
            {Number(totals.itemDiscountTotal) > 0 && <Row label="Item Discounts" value={`− ${money(totals.itemDiscountTotal)}`} />}
            <Row label="Taxable Amount" value={money(totals.taxableAmount)} />
            {taxBreakup === "CGST_SGST" ? (
              <>
                <Row label="CGST" value={money(totals.cgstTotal)} />
                <Row label="SGST" value={money(totals.sgstTotal)} />
              </>
            ) : taxBreakup === "IGST" ? (
              <Row label="IGST" value={money(totals.igstTotal)} />
            ) : (
              <Row label="Tax (GST)" value={money(totals.taxTotal)} />
            )}
            {Number(totals.shippingCharge) > 0 && <Row label="Shipping" value={money(totals.shippingCharge)} />}
            {Number(totals.miscCharge) > 0 && <Row label={miscChargeLabel || "Misc. Charges"} value={money(totals.miscCharge)} />}
            {Number(totals.additionalDiscount) > 0 && (
              <Row label="Additional Discount" value={`− ${money(totals.additionalDiscount)}`} />
            )}
            {Number(totals.roundOff) !== 0 && <Row label="Round Off" value={money(totals.roundOff)} />}
            <div className="h-px bg-border my-2" />
            <Row label="Grand Total" value={money(totals.grandTotal)} strong />
          </div>
        </div>

        {(customerNotes || termsAndConditions) && (
          <div className="grid sm:grid-cols-2 gap-6 pt-2 border-t border-border text-xs">
            {customerNotes && (
              <div>
                <p className="font-medium text-foreground mb-1">Notes</p>
                <p className="text-muted-foreground whitespace-pre-line">{customerNotes}</p>
              </div>
            )}
            {termsAndConditions && (
              <div>
                <p className="font-medium text-foreground mb-1">Terms & Conditions</p>
                <p className="text-muted-foreground whitespace-pre-line">{termsAndConditions}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "text-sm font-semibold text-foreground" : "text-muted-foreground"}`}>
      <span>{label}</span>
      <span className={strong ? "tabular-nums" : "tabular-nums text-foreground"}>{value}</span>
    </div>
  );
}
