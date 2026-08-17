import type { InvoicePreviewProps } from "@/components/invoicing/preview/InvoicePreview";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/expenses/ui";
import type { ExpenseCategory } from "@/types/expense";

/**
 * Turns the in-progress Expense form into a single-line-item
 * InvoicePreviewProps so the voucher preview can reuse the existing
 * InvoiceTemplateRenderer/3 templates instead of a second rendering engine.
 * Never persisted as a real Invoice — purely a display-time adapter.
 */
export function buildExpenseVoucherPreviewProps(input: {
  ownerName: string;
  occurredAt: string; // yyyy-mm-dd
  amount: string;
  currency: string;
  category: ExpenseCategory;
  customCategoryLabel: string;
  partyLabel: string; // buyer / supplier / manual company name, whichever applies
  gstNumber: string;
  gstPercent: number | null;
  notes: string;
  referenceNumber: string;
  isSupplierLinked: boolean;
}): InvoicePreviewProps {
  const description =
    input.category === "OTHER" && input.customCategoryLabel ? input.customCategoryLabel : EXPENSE_CATEGORY_LABELS[input.category];
  const amountNum = Number(input.amount) || 0;
  const taxPercent = input.gstPercent ?? 0;
  const taxAmount = (amountNum * taxPercent) / 100;
  const grandTotal = amountNum + taxAmount;
  const date = input.occurredAt || new Date().toISOString().slice(0, 10);

  return {
    // A "voucher" isn't a Sales/Purchase document, but the renderer needs a
    // type to pick a header label — Purchase reads closest to an operational
    // expense voucher, Sales only when the expense is explicitly buyer-linked.
    type: input.isSupplierLinked ? "PURCHASE" : "SALES",
    invoiceNumber: `EXP-${date.replace(/-/g, "")}`,
    invoiceDate: date,
    dueDate: date,
    currency: input.currency,
    referenceNumber: input.referenceNumber || null,

    sellerName: input.ownerName,

    partyName: input.partyLabel || "—",
    partyTaxId: input.gstNumber || null,

    taxMode: "EXCLUSIVE",
    taxBreakup: "SINGLE",

    items: [
      {
        productName: description,
        quantity: 1,
        unit: "pcs",
        rate: amountNum.toFixed(2),
        taxPercent,
        taxAmount: taxAmount.toFixed(2),
        lineTotal: grandTotal.toFixed(2),
      },
    ],
    totals: {
      subtotal: amountNum.toFixed(2),
      itemDiscountTotal: "0.00",
      taxableAmount: amountNum.toFixed(2),
      cgstTotal: "0.00",
      sgstTotal: "0.00",
      igstTotal: taxAmount.toFixed(2),
      taxTotal: taxAmount.toFixed(2),
      shippingType: "FIXED",
      shippingValue: "0.00",
      shippingCharge: "0.00",
      additionalChargesTotal: "0.00",
      additionalDiscount: "0.00",
      roundOff: "0.00",
      grandTotal: grandTotal.toFixed(2),
    },
    additionalCharges: [],

    customerNotes: input.notes || null,
  };
}
