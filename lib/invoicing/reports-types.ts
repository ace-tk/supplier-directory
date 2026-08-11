// Client-safe report types/labels — kept separate from lib/invoicing/reports.ts
// (which imports `db` and must never be pulled into a client bundle).

import type { InvoiceType, InvoiceStatus } from "@/types/invoicing";

export type ReportKind = "SALES" | "PURCHASE" | "RECEIVABLES" | "PAYABLES" | "GST_SUMMARY" | "EXPENSE" | "PAYMENT";

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  SALES: "Sales Report",
  PURCHASE: "Purchase Report",
  RECEIVABLES: "Receivables Report",
  PAYABLES: "Payables Report",
  GST_SUMMARY: "Tax / GST Summary",
  EXPENSE: "Expense Report",
  PAYMENT: "Payment Report",
};

export interface ReportFilter {
  dateFrom?: string;
  dateTo?: string;
  partyName?: string;
  status?: InvoiceStatus;
  documentType?: InvoiceType;
}

export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right";
}

export interface ReportResult {
  columns: ReportColumn[];
  rows: Record<string, string>[];
}
