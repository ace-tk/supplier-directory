"use client";

// Real Excel import/template for bulk Expense creation — same SheetJS
// (xlsx) dependency and parsing approach as lib/catalog-io.ts. Only
// parsing happens here; resolving parties/invoices and writing to the
// database always happens server-side (see lib/expenses/import.ts).

import * as XLSX from "xlsx";
import { EXPENSE_CATEGORY_OPTIONS, EXPENSE_CATEGORY_LABELS } from "@/lib/expenses/ui";
import { EXPENSE_IMPORT_TEMPLATE_HEADERS, type ExpenseImportRawRow } from "@/lib/expenses/import-types";

function cellToDateString(value: unknown): string {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value ?? "").trim();
}

function cellToTimeString(value: unknown): string {
  if (value instanceof Date) {
    const h = String(value.getHours()).padStart(2, "0");
    const m = String(value.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }
  return String(value ?? "").trim();
}

function cellToText(value: unknown): string {
  return String(value ?? "").trim();
}

/** Parses a .xlsx/.xls file into raw, unvalidated rows. Blank trailing rows are dropped. */
export function parseExpenseImportFile(file: File): Promise<ExpenseImportRawRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: "binary", cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        function get(line: Record<string, unknown>, label: string): unknown {
          const key = Object.keys(line).find((k) => k.trim().toLowerCase() === label.toLowerCase());
          return key ? line[key] : "";
        }

        const rows: ExpenseImportRawRow[] = raw.map((line, i) => ({
          rowNumber: i + 2, // header occupies row 1
          date: cellToDateString(get(line, "Date")),
          time: cellToTimeString(get(line, "Time")),
          category: cellToText(get(line, "Category")),
          location: cellToText(get(line, "Location")),
          amount: cellToText(get(line, "Amount")),
          currency: cellToText(get(line, "Currency")),
          party: cellToText(get(line, "Buyer/Supplier")),
          invoice: cellToText(get(line, "Related Invoice")),
          notes: cellToText(get(line, "Notes")),
        }));

        resolve(rows.filter((r) => r.date || r.amount || r.category || r.party || r.notes));
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsBinaryString(file);
  });
}

/** Downloads a filled-in-example .xlsx with the exact columns confirmExpenseImportAction expects, plus a reference sheet of valid categories. */
export function downloadExpenseImportTemplate() {
  const example = [
    "2026-08-01",
    "14:30",
    EXPENSE_CATEGORY_LABELS.SHIPPING,
    "Mumbai Port",
    "1500",
    "INR",
    "Acme Traders",
    "INV-2026-0001",
    "Courier charges",
  ];
  const sheet = XLSX.utils.aoa_to_sheet([[...EXPENSE_IMPORT_TEMPLATE_HEADERS], example]);
  sheet["!cols"] = EXPENSE_IMPORT_TEMPLATE_HEADERS.map(() => ({ wch: 18 }));

  const categorySheet = XLSX.utils.aoa_to_sheet([
    ["Valid Categories"],
    ...EXPENSE_CATEGORY_OPTIONS.map((c) => [EXPENSE_CATEGORY_LABELS[c]]),
  ]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Expenses");
  XLSX.utils.book_append_sheet(workbook, categorySheet, "Categories");
  XLSX.writeFile(workbook, "expense-import-template.xlsx");
}
