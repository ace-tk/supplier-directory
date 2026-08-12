import type { InvoicePreviewProps } from "@/components/invoicing/preview/InvoicePreview";
import { formatMoney, formatShortDate, INVOICE_TYPE_LABELS } from "@/lib/invoicing/ui";
import { invoiceFamily } from "@/lib/invoicing/family";

/**
 * Bold editorial / premium / warm document design — inspired by a large
 * red "INVOICE" heading on a warm off-white background. Pure presentation:
 * every value is read directly from the already-computed InvoicePreviewProps
 * (same shared view model the Regular template and the PDF/print pipeline
 * use) — no calculation happens here.
 */
export function ClassicRedInvoiceTemplate(props: InvoicePreviewProps) {
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
    partyTaxId,
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
    className,
  } = props;

  const money = (v: string) => formatMoney(v, currency);
  const partyLabel = invoiceFamily(type) === "SALES" ? "Bill To" : "Bill From";
  const hasBankingDetails = Boolean(bankAccountHolder || bankName || bankAccountNumber || bankIfscCode || bankBranch || bankUpiId);

  return (
    <div className={`overflow-hidden rounded-2xl border border-[#e7ddc9] bg-[#FBF5E9] text-[#221c14] shadow-card ${className ?? ""}`}>
      <div className="p-8 sm:p-12 space-y-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <h1 className="text-6xl sm:text-7xl font-black tracking-tight text-[#B3261E] leading-none">
            {INVOICE_TYPE_LABELS[type].split(" ")[0].toUpperCase()}
          </h1>
          <div className="text-right space-y-0.5">
            <p className="text-lg font-bold text-[#221c14]">{sellerName || "Your Company"}</p>
            {sellerAddress && <p className="text-xs text-[#5c5347] whitespace-pre-line max-w-xs ml-auto">{sellerAddress}</p>}
            <div className="text-xs text-[#5c5347] space-x-2">
              {sellerEmail && <span>{sellerEmail}</span>}
              {sellerPhone && <span>{sellerPhone}</span>}
            </div>
            {sellerTaxId && <p className="text-xs text-[#5c5347]">GSTIN: {sellerTaxId}</p>}
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs border-y border-[#e7ddc9] py-4">
          <div>
            <p className="uppercase tracking-wide text-[#8a7f6c] font-semibold">Invoice Number</p>
            <p className="font-mono text-sm mt-0.5">{invoiceNumber || "—"}</p>
          </div>
          <div>
            <p className="uppercase tracking-wide text-[#8a7f6c] font-semibold">Invoice Date</p>
            <p className="text-sm mt-0.5">{isoOrRaw(invoiceDate)}</p>
          </div>
          <div>
            <p className="uppercase tracking-wide text-[#8a7f6c] font-semibold">Due Date</p>
            <p className="text-sm mt-0.5">{isoOrRaw(dueDate)}</p>
          </div>
          {referenceNumber && (
            <div>
              <p className="uppercase tracking-wide text-[#8a7f6c] font-semibold">Reference</p>
              <p className="text-sm mt-0.5">{referenceNumber}</p>
            </div>
          )}
        </div>

        {/* Bill To / Payment Details */}
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs uppercase tracking-wide font-bold text-[#B3261E] mb-1.5">{partyLabel}</p>
            <p className="font-semibold text-sm">{partyName || "—"}</p>
            {partyContactPerson && <p className="text-xs text-[#5c5347] mt-0.5">Attn: {partyContactPerson}</p>}
            <div className="text-xs text-[#5c5347] mt-0.5 space-x-2">
              {partyEmail && <span>{partyEmail}</span>}
              {partyPhone && <span>{partyPhone}</span>}
            </div>
            {partyTaxId && <p className="text-xs text-[#5c5347] mt-0.5">GSTIN: {partyTaxId}</p>}
            {partyBillingAddress && <p className="text-xs text-[#5c5347] whitespace-pre-line mt-1">{partyBillingAddress}</p>}
          </div>
          {hasBankingDetails && (
            <div>
              <p className="text-xs uppercase tracking-wide font-bold text-[#B3261E] mb-1.5">Payment Details</p>
              <div className="text-xs text-[#5c5347] space-y-0.5">
                {bankAccountHolder && <p>{bankAccountHolder}</p>}
                {bankName && <p>{bankName}</p>}
                {bankAccountNumber && <p>A/C: {bankAccountNumber}</p>}
                {bankIfscCode && <p>IFSC: {bankIfscCode}</p>}
                {bankBranch && <p>{bankBranch}</p>}
                {bankUpiId && <p>UPI: {bankUpiId}</p>}
                {paymentTerms && <p className="pt-1">Terms: {paymentTerms}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Items table */}
        <div className="overflow-x-auto rounded-lg border-2 border-[#221c14]">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#221c14] text-[#FBF5E9]">
                <th className="text-left font-semibold px-3 py-2.5">Description</th>
                <th className="text-left font-semibold px-3 py-2.5">HSN/SAC</th>
                <th className="text-right font-semibold px-3 py-2.5">Qty</th>
                <th className="text-right font-semibold px-3 py-2.5">Rate</th>
                <th className="text-right font-semibold px-3 py-2.5">Tax</th>
                <th className="text-right font-semibold px-3 py-2.5">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7ddc9]">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-[#8a7f6c]">
                    No items added yet
                  </td>
                </tr>
              ) : (
                items.map((item, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2.5 align-top">
                      <p className="font-medium">{item.productName || "Untitled item"}</p>
                      {item.description && <p className="text-[#8a7f6c] mt-0.5">{item.description}</p>}
                    </td>
                    <td className="px-3 py-2.5 align-top text-[#5c5347]">{item.hsnSac || "—"}</td>
                    <td className="px-3 py-2.5 align-top text-right tabular-nums">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="px-3 py-2.5 align-top text-right tabular-nums">{money(String(item.rate))}</td>
                    <td className="px-3 py-2.5 align-top text-right tabular-nums">{item.taxPercent ? `${item.taxPercent}%` : "—"}</td>
                    <td className="px-3 py-2.5 align-top text-right tabular-nums font-medium">{money(item.lineTotal)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full sm:w-80 space-y-1.5 text-xs">
            <ClassicRow label="Subtotal" value={money(totals.subtotal)} />
            {Number(totals.itemDiscountTotal) > 0 && <ClassicRow label="Discount" value={`− ${money(totals.itemDiscountTotal)}`} />}
            {taxBreakup === "CGST_SGST" ? (
              <>
                <ClassicRow label="CGST" value={money(totals.cgstTotal)} />
                <ClassicRow label="SGST" value={money(totals.sgstTotal)} />
              </>
            ) : taxBreakup === "IGST" ? (
              <ClassicRow label="IGST" value={money(totals.igstTotal)} />
            ) : (
              Number(totals.taxTotal) > 0 && <ClassicRow label="GST" value={money(totals.taxTotal)} />
            )}
            {Number(totals.shippingCharge) > 0 && (
              <ClassicRow
                label={totals.shippingType === "PERCENT" ? `Shipping (${totals.shippingValue}%)` : "Shipping"}
                value={money(totals.shippingCharge)}
              />
            )}
            {additionalCharges.map((c, i) => (
              <ClassicRow key={i} label={c.type === "PERCENT" ? `${c.name} (${c.value}%)` : c.name} value={money(c.amount)} />
            ))}
            {Number(totals.additionalDiscount) > 0 && <ClassicRow label="Additional Discount" value={`− ${money(totals.additionalDiscount)}`} />}
            {Number(totals.roundOff) !== 0 && <ClassicRow label="Round Off" value={money(totals.roundOff)} />}
            <div className="h-0.5 bg-[#221c14] my-2" />
            <div className="flex items-center justify-between text-base font-black text-[#B3261E]">
              <span>GRAND TOTAL</span>
              <span className="tabular-nums">{money(totals.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        {(termsAndConditions || customerNotes || sellerEmail || sellerPhone) && (
          <div className="grid sm:grid-cols-3 gap-6 pt-6 border-t-2 border-[#221c14] text-xs">
            <div>
              <p className="font-bold uppercase tracking-wide mb-1">Terms &amp; Conditions</p>
              <p className="text-[#5c5347] whitespace-pre-line">{termsAndConditions || customerNotes || "—"}</p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-wide mb-1">Contact Details</p>
              <p className="text-[#5c5347]">{sellerEmail || "—"}</p>
              <p className="text-[#5c5347]">{sellerPhone || ""}</p>
            </div>
            <div className="text-right">
              <p className="font-bold uppercase tracking-wide mb-6">Signature</p>
              <div className="border-t border-[#221c14] pt-1 inline-block min-w-[140px]">
                <p className="text-[#5c5347]">{sellerName}</p>
              </div>
            </div>
          </div>
        )}
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

function ClassicRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[#5c5347]">
      <span>{label}</span>
      <span className="tabular-nums text-[#221c14] font-medium">{value}</span>
    </div>
  );
}
