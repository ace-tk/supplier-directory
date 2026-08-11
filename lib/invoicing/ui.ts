import type { InvoiceStatus, InvoiceTaxMode, InvoiceTaxBreakup, InvoiceType, InvoiceReason, PaymentMethod } from "@/types/invoicing";

export { formatShortDate, formatDateTime } from "@/lib/supply-chain-ui";

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  SALES: "Tax Invoice",
  PURCHASE: "Purchase Invoice",
  QUOTATION: "Quotation / Estimate",
  CREDIT_NOTE: "Credit Note",
  SALES_RETURN: "Sales Return",
  DEBIT_NOTE: "Debit Note",
};

export const INVOICE_REASON_LABELS: Record<InvoiceReason, string> = {
  DAMAGED_GOODS: "Damaged Goods",
  PRICE_ADJUSTMENT: "Price Adjustment",
  PRODUCT_RETURN: "Product Return",
  BILLING_ERROR: "Billing Error",
  DISCOUNT_ADJUSTMENT: "Discount Adjustment",
  OTHER: "Other",
};

export const INVOICE_REASON_OPTIONS: InvoiceReason[] = [
  "DAMAGED_GOODS",
  "PRICE_ADJUSTMENT",
  "PRODUCT_RETURN",
  "BILLING_ERROR",
  "DISCOUNT_ADJUSTMENT",
  "OTHER",
];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PENDING: "Pending",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  CANCELLED: "Cancelled",
  // Quotation lifecycle
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  CONVERTED: "Converted",
  // Credit Note / Sales Return / Debit Note lifecycle
  ISSUED: "Issued",
  APPLIED: "Applied",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  UPI: "UPI",
  CARD: "Card",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

export const PAYMENT_METHOD_OPTIONS: PaymentMethod[] = ["CASH", "BANK_TRANSFER", "UPI", "CARD", "CHEQUE", "OTHER"];

export const TAX_MODE_LABELS: Record<InvoiceTaxMode, string> = {
  EXCLUSIVE: "Tax-exclusive (add tax on top)",
  INCLUSIVE: "Tax-inclusive (rate already includes tax)",
};

export const TAX_BREAKUP_LABELS: Record<InvoiceTaxBreakup, string> = {
  SINGLE: "Single GST (no breakup)",
  CGST_SGST: "CGST + SGST (intra-state)",
  IGST: "IGST (inter-state)",
};

const CURRENCY_LOCALE: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
};

/** Formats a decimal string/number as currency. Money values in this module are always 2dp strings. */
export function formatMoney(value: string | number, currency = "INR"): string {
  const amount = typeof value === "string" ? Number(value) : value;
  const locale = CURRENCY_LOCALE[currency] ?? "en-IN";
  if (!Number.isFinite(amount)) return "—";
  return amount.toLocaleString(locale, { style: "currency", currency, maximumFractionDigits: 2 });
}

/** Subtle Due Today/Due Soon/Overdue/Paid indicator for list rows — null means no indicator is warranted. */
export function getDueIndicatorLabel(inv: { status: InvoiceStatus; dueDate: string; balanceDue: string; isOverdue: boolean }): string | null {
  if (inv.status === "PAID") return "Paid";
  if (inv.isOverdue) return "Overdue";
  if (Number(inv.balanceDue) <= 0) return null;

  const due = new Date(inv.dueDate);
  if (Number.isNaN(due.getTime())) return null;
  const daysUntilDue = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysUntilDue === 0) return "Due Today";
  if (daysUntilDue > 0 && daysUntilDue <= 3) return "Due Soon";
  return null;
}

export function formatQuantity(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "0";
  return n % 1 === 0 ? String(n) : n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}
