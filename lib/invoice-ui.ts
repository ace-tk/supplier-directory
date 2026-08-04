import type { InvoiceStatus } from "@/types/invoice";

export { formatShortDate, formatFileSize } from "@/lib/supply-chain-ui";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PAID: "Paid",
  PENDING: "Pending",
  OVERDUE: "Overdue",
};

export const INVOICE_STATUS_OPTIONS: InvoiceStatus[] = ["DRAFT", "SENT", "PAID", "PENDING", "OVERDUE"];

export function formatMoney(n: number, currency = "INR") {
  return n.toLocaleString("en-IN", { style: "currency", currency, maximumFractionDigits: 0 });
}
