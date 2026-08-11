// Client-safe types for the Excel import flow — kept separate from
// lib/expenses/import.ts (which imports `db` and must never reach the
// client bundle), mirroring the lib/invoicing/reports-types.ts split.

import type { ExpenseCategory } from "@/types/expense";

/** One row as parsed straight from the spreadsheet — all strings, unvalidated. */
export interface ExpenseImportRawRow {
  rowNumber: number;
  date: string;
  time: string;
  category: string;
  location: string;
  amount: string;
  currency: string;
  party: string;
  invoice: string;
  notes: string;
}

export interface ExpenseImportResolvedRow {
  occurredAt: string | null;
  location: string;
  category: ExpenseCategory | null;
  customCategoryId: string | null;
  amount: string | null;
  currency: string | null;
  notes: string;
  partyUserId: string | null;
  partyLabel: string | null;
  relatedInvoiceId: string | null;
  relatedInvoiceLabel: string | null;
}

export interface ExpenseImportRowResult {
  rowNumber: number;
  raw: ExpenseImportRawRow;
  status: "valid" | "invalid";
  errors: string[];
  resolved: ExpenseImportResolvedRow;
}

export interface ExpenseImportSummary {
  importedCount: number;
  rejectedCount: number;
  rows: ExpenseImportRowResult[];
}

export const EXPENSE_IMPORT_TEMPLATE_HEADERS = [
  "Date",
  "Time",
  "Category",
  "Location",
  "Amount",
  "Currency",
  "Buyer/Supplier",
  "Related Invoice",
  "Notes",
] as const;

export const EXPENSE_IMPORT_MAX_ROWS = 500;
