"use client";

// Real CSV/Excel import & export for Catalog Management, via SheetJS (xlsx) —
// one library cleanly covers both formats.

import * as XLSX from "xlsx";
import { CATALOG_COLUMN_LABELS, CATALOG_EXPORT_COLUMNS, type CatalogRowRecord } from "@/types/catalog";
import type { CatalogRowInput } from "@/lib/validations/catalog";

export function exportRowsToFile(rows: CatalogRowRecord[], format: "csv" | "xlsx", fileName = "catalog") {
  const data = rows.map((row) => {
    const record: Record<string, string | number> = {};
    for (const col of CATALOG_EXPORT_COLUMNS) {
      const label = CATALOG_COLUMN_LABELS[col];
      const value = row[col];
      record[label] = Array.isArray(value) ? value.join(", ") : (value ?? "");
    }
    return record;
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Catalog");
  XLSX.writeFile(workbook, `${fileName}.${format}`, { bookType: format === "csv" ? "csv" : "xlsx" });
}

const LABEL_TO_FIELD: Record<string, keyof CatalogRowInput> = Object.fromEntries(
  Object.entries(CATALOG_COLUMN_LABELS).map(([field, label]) => [label.toLowerCase(), field as keyof CatalogRowInput])
);

const NUMERIC_FIELDS = new Set(["quantity", "moq", "gstPercent", "priceBeforeGst", "priceAfterGst", "shippingCost", "miscCost"]);

function normalizeHeader(header: string): keyof CatalogRowInput | null {
  const key = header.trim().toLowerCase();
  if (LABEL_TO_FIELD[key]) return LABEL_TO_FIELD[key];
  // Also accept raw field names (e.g. a re-imported export of our own field keys).
  const directMatch = (Object.keys(CATALOG_COLUMN_LABELS) as (keyof CatalogRowInput)[]).find(
    (f) => f.toLowerCase() === key
  );
  return directMatch ?? null;
}

export function parseFileToRows(file: File): Promise<Partial<CatalogRowInput>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        const rows: Partial<CatalogRowInput>[] = raw.map((line) => {
          const row: Record<string, unknown> = {};
          for (const [header, value] of Object.entries(line)) {
            const field = normalizeHeader(header);
            if (!field) continue;
            if (field === "sizes") {
              row.sizes = String(value)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            } else if (NUMERIC_FIELDS.has(field)) {
              row[field] = value === "" ? 0 : Number(value);
            } else if (field === "status") {
              const s = String(value).toUpperCase();
              row.status = ["ACTIVE", "INACTIVE", "DRAFT"].includes(s) ? s : "ACTIVE";
            } else {
              row[field] = String(value);
            }
          }
          return row as Partial<CatalogRowInput>;
        });

        resolve(rows.filter((r) => r.productName && String(r.productName).trim().length > 0));
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsBinaryString(file);
  });
}
