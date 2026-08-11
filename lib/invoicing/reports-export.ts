"use client";

// Real CSV export for Reports — same SheetJS (xlsx) pattern as
// lib/catalog-io.ts's exportRowsToFile, exporting exactly the filtered
// dataset the user is looking at (no separate/fake dataset).

import * as XLSX from "xlsx";
import type { ReportResult } from "@/lib/invoicing/reports-types";

export function exportReportToCsv(report: ReportResult, fileName: string) {
  const data = report.rows.map((row) => {
    const record: Record<string, string> = {};
    for (const col of report.columns) {
      record[col.label] = row[col.key] ?? "";
    }
    return record;
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  XLSX.writeFile(workbook, `${fileName}.csv`, { bookType: "csv" });
}
