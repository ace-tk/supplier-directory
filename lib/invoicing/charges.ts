import type { InvoiceRecord, InvoiceAdditionalChargeRecord, ChargeType } from "@/types/invoicing";

/**
 * Rows saved before Shipping Type/Additional Charges existed have
 * shippingValue=0 (the schema default) but a real, historical
 * shippingCharge amount, and a single legacy miscCharge/miscChargeLabel
 * instead of any additionalCharges rows. Used by both the editor
 * (formFromRecord) and the preview/PDF (toInvoicePreviewProps) so a
 * pre-existing invoice keeps showing its real numbers in both places
 * identically, without a data migration and without ever writing to the
 * deprecated columns again.
 */
export function resolveLegacyShipping(record: InvoiceRecord): { shippingType: ChargeType; shippingValue: string } {
  if (Number(record.shippingValue) === 0 && Number(record.shippingCharge) > 0) {
    return { shippingType: "FIXED", shippingValue: record.shippingCharge };
  }
  return { shippingType: record.shippingType, shippingValue: record.shippingValue };
}

export function resolveLegacyAdditionalCharges(record: InvoiceRecord): InvoiceAdditionalChargeRecord[] {
  if (record.additionalCharges.length > 0) return record.additionalCharges;
  if (Number(record.miscCharge) > 0) {
    return [
      {
        id: "legacy-misc-charge",
        name: record.miscChargeLabel || "Additional Charges",
        type: "FIXED",
        value: record.miscCharge,
        amount: record.miscCharge,
        order: 0,
      },
    ];
  }
  return [];
}
