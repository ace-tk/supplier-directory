"use client";

// Lazily-loaded SheetJS (`xlsx`) — reads both XLSX and legacy XLS (BIFF)
// natively, so both formats route through this one client. Only imported
// inside components that actually render a spreadsheet.

import { dataUrlToUint8Array } from "@/lib/pdf-client";

let xlsxPromise: Promise<typeof import("xlsx")> | null = null;

function getXlsx() {
  if (!xlsxPromise) xlsxPromise = import("xlsx");
  return xlsxPromise;
}

// A safety cap, not a format limitation — a spreadsheet can have far more
// cells than are useful (or performant) to hold in the DOM at once. The UI
// surfaces `truncatedRows`/`truncatedCols` honestly rather than silently
// dropping data.
const MAX_ROWS = 500;
const MAX_COLS = 60;

export interface SpreadsheetSheet {
  name: string;
  rows: string[][];
  truncatedRows: boolean;
  truncatedCols: boolean;
  totalRows: number;
  totalCols: number;
}

export interface SpreadsheetWorkbook {
  sheets: SpreadsheetSheet[];
}

// SheetJS is deliberately lenient — given bytes that match none of its
// binary formats it falls back to treating them as delimited text (PRN/
// CSV-like), so genuinely corrupt input can "succeed" with a workbook full
// of garbled rows instead of throwing. Checking the real container
// signature first (ZIP for XLSX, OLE/CFB for legacy XLS) turns that into
// an honest parse error instead of a fake-looking preview.
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function hasSignature(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, i) => bytes[i] === byte);
}

export async function readSpreadsheet(dataUrl: string): Promise<SpreadsheetWorkbook> {
  const bytes = dataUrlToUint8Array(dataUrl);
  if (!hasSignature(bytes, ZIP_SIGNATURE) && !hasSignature(bytes, OLE_SIGNATURE)) {
    throw new Error("This doesn't look like a valid XLS or XLSX file.");
  }
  const XLSX = await getXlsx();
  const workbook = XLSX.read(bytes, { type: "array", cellDates: true });

  const sheets: SpreadsheetSheet[] = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const ref = sheet["!ref"];
    if (!ref) return { name, rows: [], truncatedRows: false, truncatedCols: false, totalRows: 0, totalCols: 0 };

    const range = XLSX.utils.decode_range(ref);
    const totalRows = range.e.r - range.s.r + 1;
    const totalCols = range.e.c - range.s.c + 1;
    const truncatedRows = totalRows > MAX_ROWS;
    const truncatedCols = totalCols > MAX_COLS;
    const limitedRange = {
      s: range.s,
      e: {
        r: truncatedRows ? range.s.r + MAX_ROWS - 1 : range.e.r,
        c: truncatedCols ? range.s.c + MAX_COLS - 1 : range.e.c,
      },
    };

    const aoa = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      range: limitedRange,
      raw: false,
      defval: "",
      dateNF: "yyyy-mm-dd",
    }) as unknown[][];

    const rows = aoa.map((row) => row.map((cell) => (cell === null || cell === undefined ? "" : String(cell))));
    return { name, rows, truncatedRows, truncatedCols, totalRows, totalCols };
  });

  return { sheets };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Compact HTML table of one sheet's visible data, for AI Summarize only —
 * never used for Edit in Editor, which would dump raw cells into the rich
 * text editor. Capped independently of the on-screen row limit so a huge
 * sheet doesn't blow up the summarization prompt. */
export function sheetToSummaryHtml(sheet: SpreadsheetSheet): string {
  const rows = sheet.rows.slice(0, 200);
  const body = rows.map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`).join("");
  return `<table><tbody>${body}</tbody></table>`;
}
