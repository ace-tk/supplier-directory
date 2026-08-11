import type { InvoiceType, InvoiceStatus } from "@/types/invoicing";

/**
 * Document-specific status lifecycle. "Sent" means the same word across
 * document types, but which statuses are reachable — and manually
 * settable — differs per type. PARTIALLY_PAID/PAID are deliberately
 * excluded from every manually-settable set: they're system-derived from
 * real Payment rows (see lib/invoicing/payments.ts) and auto-written by
 * recordPaymentAction, never chosen by hand, so the badge can never claim
 * "Paid" without a real payment behind it. CONVERTED is likewise
 * system-set only, by createInvoiceAction when a Tax Invoice is derived
 * from a Quotation.
 */
export const ALLOWED_STATUSES_BY_TYPE: Record<InvoiceType, InvoiceStatus[]> = {
  SALES: ["DRAFT", "SENT", "PENDING", "CANCELLED"],
  PURCHASE: ["DRAFT", "SENT", "PENDING", "CANCELLED"],
  QUOTATION: ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"],
  CREDIT_NOTE: ["DRAFT", "ISSUED", "APPLIED", "CANCELLED"],
  SALES_RETURN: ["DRAFT", "ISSUED", "APPLIED", "CANCELLED"],
  DEBIT_NOTE: ["DRAFT", "ISSUED", "APPLIED", "CANCELLED"],
};

/** All statuses valid to *display* for a type, including system-set ones not offered for manual change. */
export const DISPLAYABLE_STATUSES_BY_TYPE: Record<InvoiceType, InvoiceStatus[]> = {
  SALES: ["DRAFT", "SENT", "PENDING", "PARTIALLY_PAID", "PAID", "CANCELLED"],
  PURCHASE: ["DRAFT", "SENT", "PENDING", "PARTIALLY_PAID", "PAID", "CANCELLED"],
  QUOTATION: ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"],
  CREDIT_NOTE: ["DRAFT", "ISSUED", "APPLIED", "CANCELLED"],
  SALES_RETURN: ["DRAFT", "ISSUED", "APPLIED", "CANCELLED"],
  DEBIT_NOTE: ["DRAFT", "ISSUED", "APPLIED", "CANCELLED"],
};

export function isManuallySettableStatus(type: InvoiceType, status: InvoiceStatus): boolean {
  return ALLOWED_STATUSES_BY_TYPE[type].includes(status);
}
