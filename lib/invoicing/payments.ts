import Decimal from "decimal.js";

/**
 * Shared payment-summary math — the single function every read path
 * (record-payment mutation, invoice detail, list, dashboard, reports) uses
 * to turn "grand total + a list of payments" into amountPaid/balanceDue,
 * so those numbers can never drift between screens. Same anti-drift
 * principle as lib/invoicing/calc.ts.
 */

export interface PaymentSummaryInput {
  amount: string;
}

export interface InvoicePaymentSummary {
  amountPaid: string;
  balanceDue: string;
  isFullyPaid: boolean;
  isPartiallyPaid: boolean;
}

function money(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function computeInvoicePaymentSummary(grandTotal: string, payments: PaymentSummaryInput[]): InvoicePaymentSummary {
  const total = money(new Decimal(grandTotal || 0));
  const amountPaid = money(payments.reduce((acc, p) => acc.plus(new Decimal(p.amount || 0)), new Decimal(0)));
  const balanceDue = money(Decimal.max(total.minus(amountPaid), 0));

  return {
    amountPaid: amountPaid.toFixed(2),
    balanceDue: balanceDue.toFixed(2),
    isFullyPaid: amountPaid.gte(total) && total.gt(0),
    isPartiallyPaid: amountPaid.gt(0) && amountPaid.lt(total),
  };
}

/** dueDate < now AND balanceDue > 0 AND status not in (PAID, CANCELLED) — never stored, computed at read time. */
export function isInvoiceOverdue(dueDate: Date, balanceDue: string, status: string): boolean {
  if (status === "PAID" || status === "CANCELLED") return false;
  if (new Decimal(balanceDue || 0).lte(0)) return false;
  return dueDate.getTime() < Date.now();
}
