import type { InvoicePreviewProps } from "@/components/invoicing/preview/InvoicePreview";
import { formatMoney, formatShortDate, INVOICE_TYPE_LABELS } from "@/lib/invoicing/ui";
import { invoiceFamily } from "@/lib/invoicing/family";

/**
 * Modern, typography-driven, monochrome document design — bold black
 * headings on white, thin hairline separators, lots of whitespace. Pure
 * presentation over the same InvoicePreviewProps every other template and
 * the PDF/print pipeline consume — no calculation here.
 */
export function MinimalStudioInvoiceTemplate(props: InvoicePreviewProps) {
  const {
    type,
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
    partyName,
    partyContactPerson,
    partyEmail,
    partyPhone,
    partyBillingAddress,
    taxBreakup,
    items,
    totals,
    additionalCharges,
    customerNotes,
    termsAndConditions,
    bankAccountHolder,
    bankName,
    bankAccountNumber,
    bankIfscCode,
    bankBranch,
    bankUpiId,
    bankPaymentInstructions,
    amountPaid,
    balanceDue,
    className,
  } = props;

  const money = (v: string) => formatMoney(v, currency);
  const partyLabel = invoiceFamily(type) === "SALES" ? "Buyer / Client" : "Supplier / Vendor";
  const hasBankingDetails = Boolean(bankAccountHolder || bankName || bankAccountNumber || bankIfscCode || bankBranch || bankUpiId);

  return (
    <div className={`overflow-hidden rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-card ${className ?? ""}`}>
      <div className="p-8 sm:p-12 space-y-8">
        {/* Brand */}
        <p className="text-xl font-black tracking-tight uppercase">{sellerName || "Your Company"}</p>

        {/* Metadata row + title */}
        <div className="flex items-start justify-between gap-6 flex-wrap border-t border-b border-neutral-200 py-4">
          <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-xs">
            <div>
              <p className="text-neutral-400 uppercase tracking-wide">Invoice Date</p>
              <p className="font-medium mt-0.5">{isoOrRaw(invoiceDate)}</p>
            </div>
            <div>
              <p className="text-neutral-400 uppercase tracking-wide">Invoice Number</p>
              <p className="font-mono font-medium mt-0.5">{invoiceNumber || "—"}</p>
            </div>
            <div>
              <p className="text-neutral-400 uppercase tracking-wide">Due Date</p>
              <p className="font-medium mt-0.5">{isoOrRaw(dueDate)}</p>
            </div>
            <div>
              <p className="text-neutral-400 uppercase tracking-wide">{partyLabel}</p>
              <p className="font-medium mt-0.5">{partyName || "—"}</p>
            </div>
            {referenceNumber && (
              <div>
                <p className="text-neutral-400 uppercase tracking-wide">Reference</p>
                <p className="font-medium mt-0.5">{referenceNumber}</p>
              </div>
            )}
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none">{INVOICE_TYPE_LABELS[type].split(" ")[0].toUpperCase()}</h1>
        </div>

        {/* Party detail */}
        <div className="text-xs text-neutral-600 space-y-0.5">
          {partyContactPerson && <p>Attn: {partyContactPerson}</p>}
          <div className="space-x-3">
            {partyEmail && <span>{partyEmail}</span>}
            {partyPhone && <span>{partyPhone}</span>}
          </div>
          {partyBillingAddress && <p className="whitespace-pre-line">{partyBillingAddress}</p>}
        </div>

        {/* Items table */}
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-neutral-900">
              <th className="text-left font-semibold uppercase tracking-wide py-2">Item / Description</th>
              <th className="text-right font-semibold uppercase tracking-wide py-2">Qty</th>
              <th className="text-right font-semibold uppercase tracking-wide py-2">Rate</th>
              <th className="text-right font-semibold uppercase tracking-wide py-2">Tax</th>
              <th className="text-right font-semibold uppercase tracking-wide py-2">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-neutral-400">
                  No items added yet
                </td>
              </tr>
            ) : (
              items.map((item, i) => (
                <tr key={i}>
                  <td className="py-2.5 align-top">
                    <p className="font-medium">{item.productName || "Untitled item"}</p>
                    {item.description && <p className="text-neutral-400 mt-0.5">{item.description}</p>}
                  </td>
                  <td className="py-2.5 align-top text-right tabular-nums">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="py-2.5 align-top text-right tabular-nums">{money(String(item.rate))}</td>
                  <td className="py-2.5 align-top text-right tabular-nums text-neutral-500">{item.taxPercent ? `${item.taxPercent}%` : "—"}</td>
                  <td className="py-2.5 align-top text-right tabular-nums font-medium">{money(item.lineTotal)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full sm:w-72 space-y-1.5 text-xs">
            <MinimalRow label="Subtotal" value={money(totals.subtotal)} />
            {taxBreakup === "CGST_SGST" ? (
              <>
                <MinimalRow label="CGST" value={money(totals.cgstTotal)} />
                <MinimalRow label="SGST" value={money(totals.sgstTotal)} />
              </>
            ) : taxBreakup === "IGST" ? (
              <MinimalRow label="IGST" value={money(totals.igstTotal)} />
            ) : (
              Number(totals.taxTotal) > 0 && <MinimalRow label="Tax / GST" value={money(totals.taxTotal)} />
            )}
            {Number(totals.itemDiscountTotal) > 0 && <MinimalRow label="Discount" value={`− ${money(totals.itemDiscountTotal)}`} />}
            {Number(totals.shippingCharge) > 0 && (
              <MinimalRow
                label={totals.shippingType === "PERCENT" ? `Shipping (${totals.shippingValue}%)` : "Shipping"}
                value={money(totals.shippingCharge)}
              />
            )}
            {additionalCharges.map((c, i) => (
              <MinimalRow key={i} label={c.type === "PERCENT" ? `${c.name} (${c.value}%)` : c.name} value={money(c.amount)} />
            ))}
            {Number(totals.additionalDiscount) > 0 && <MinimalRow label="Additional Discount" value={`− ${money(totals.additionalDiscount)}`} />}
            {Number(totals.roundOff) !== 0 && <MinimalRow label="Round Off" value={money(totals.roundOff)} />}
            <div className="h-px bg-neutral-900 my-2" />
            <div className="flex items-center justify-between text-sm font-black">
              <span>TOTAL</span>
              <span className="tabular-nums">{money(totals.grandTotal)}</span>
            </div>
            {balanceDue !== undefined && (
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-neutral-500">Balance Due</span>
                <span className="tabular-nums font-semibold">{money(balanceDue)}</span>
              </div>
            )}
            {amountPaid !== undefined && Number(amountPaid) > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500">Amount Paid</span>
                <span className="tabular-nums">{money(amountPaid)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Payment */}
        {hasBankingDetails && (
          <div className="border-t border-neutral-200 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2">Payment</p>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1 text-xs text-neutral-600">
              {bankName && <p>{bankName}</p>}
              {bankAccountHolder && <p>{bankAccountHolder}</p>}
              {bankAccountNumber && <p>A/C {bankAccountNumber}</p>}
              {bankIfscCode && <p>IFSC {bankIfscCode}</p>}
              {bankBranch && <p>{bankBranch}</p>}
              {bankUpiId && <p>UPI {bankUpiId}</p>}
              {paymentTerms && <p>Terms: {paymentTerms}</p>}
            </div>
            {bankPaymentInstructions && <p className="text-xs text-neutral-500 whitespace-pre-line mt-2">{bankPaymentInstructions}</p>}
          </div>
        )}

        {/* Terms */}
        {(termsAndConditions || customerNotes) && (
          <div className="border-t border-neutral-200 pt-5 text-xs">
            <p className="font-semibold uppercase tracking-wide mb-1.5">Terms &amp; Conditions</p>
            {termsAndConditions && <p className="text-neutral-500 whitespace-pre-line">{termsAndConditions}</p>}
            {customerNotes && <p className="text-neutral-500 whitespace-pre-line mt-1.5">{customerNotes}</p>}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-neutral-200 pt-4 text-[11px] text-neutral-400 flex flex-wrap gap-x-3 gap-y-1">
          <span>{sellerName}</span>
          {sellerAddress && <span>{sellerAddress}</span>}
          {sellerEmail && <span>{sellerEmail}</span>}
          {sellerPhone && <span>{sellerPhone}</span>}
          {sellerTaxId && <span>GSTIN {sellerTaxId}</span>}
        </div>
      </div>
    </div>
  );
}

function isoOrRaw(date: string): string {
  if (!date) return "—";
  const iso = date.length === 10 ? `${date}T00:00:00.000Z` : date;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : formatShortDate(d.toISOString());
}

function MinimalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-neutral-500">
      <span>{label}</span>
      <span className="tabular-nums text-neutral-900 font-medium">{value}</span>
    </div>
  );
}
