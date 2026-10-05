// Production export: the options, presets and the arithmetic (pixel size,
// file name, estimates). Pure — shared by the dialog, the server render and
// the tests. RGB only for now; see README "Adding CMYK / cutter files later".

export type ExportFormat = "tiff" | "pdf";

/** Inches, page space (y down). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ExportOptions {
  format: ExportFormat;
  dpi: number;
  /** Flip the whole export left-right (for transfer printing). */
  mirror: boolean;
  /** Draw the pieces' outlines and pattern marks on top of the prints. */
  cutLines: boolean;
  /** Points (1/72 in). */
  cutLineWidthPt: number;
  /** Include the size / piece label text. */
  sizeLabels: boolean;
  background: "white" | "transparent";
  /** PDF: shrink images that have more than 300 DPI at their printed size (keeps the file size sane). */
  pdfDownsample: boolean;
  /** PDF: keep text as editable text (Helvetica / Arial) instead of outlines. */
  pdfLiveText: boolean;
}

export type AreaKind = "page" | "sizes" | "selection";

export interface ExportArea {
  kind: AreaKind;
  /** For the file name: "All-sizes", "XL", "S-M", "Selection". */
  label: string;
  rect: Rect;
}

export const DPI_MIN = 72;
export const DPI_MAX = 600;
/** The dialog's quick preview. Rendered by exactly the same code as the final export, just at this resolution. */
export const PREVIEW_DPI = 20;

export const DEFAULT_EXPORT: ExportOptions = { format: "tiff", dpi: 150, mirror: false, cutLines: false, cutLineWidthPt: 0.5, sizeLabels: false, background: "white", pdfDownsample: true, pdfLiveText: false };

export interface ExportPreset {
  id: string;
  name: string;
  builtIn?: boolean;
  options: ExportOptions;
}

export const BUILT_IN_PRESETS: ExportPreset[] = [
  { id: "sublimation-150", name: "Sublimation 150 DPI (RGB)", builtIn: true, options: { ...DEFAULT_EXPORT, dpi: 150 } },
  { id: "high-quality-300", name: "High quality 300 DPI (RGB)", builtIn: true, options: { ...DEFAULT_EXPORT, dpi: 300 } },
];

/** A typed DPI, kept inside the allowed range (whole numbers only). Null if it isn't a number. */
export function clampDpi(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.min(DPI_MAX, Math.max(DPI_MIN, Math.round(value)));
}

/** Pixel size of an area: round(inches × DPI), never less than 1. */
export function pixelSize(rect: Pick<Rect, "w" | "h">, dpi: number): { width: number; height: number } {
  return { width: Math.max(1, Math.round(rect.w * dpi)), height: Math.max(1, Math.round(rect.h * dpi)) };
}

/** Classic TIFF cannot go past 4 GB; above this much uncompressed data the file is written as BigTIFF. */
export const BIGTIFF_BYTES = 3.9e9;

export interface ExportEstimate {
  width: number;
  height: number;
  /** Uncompressed size in bytes (8-bit, 3 or 4 channels). */
  rawBytes: number;
  /** A rough guess of the LZW-compressed file: flat prints compress far better, photographs worse. */
  fileBytes: number;
  seconds: number;
  bigTiff: boolean;
}

export function estimateExport(rect: Pick<Rect, "w" | "h">, options: Pick<ExportOptions, "dpi" | "background">): ExportEstimate {
  const { width, height } = pixelSize(rect, options.dpi);
  const rawBytes = width * height * (options.background === "transparent" ? 4 : 3);
  // Measured on the 6-size leggings sheet: about 0.4 s per megapixel, plus a few seconds of set-up.
  return { width, height, rawBytes, fileBytes: Math.round(rawBytes * 0.3), seconds: Math.round(3 + (width * height) / 1e6 * 0.4), bigTiff: rawBytes > BIGTIFF_BYTES };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Letters, digits, dash and dot only; spaces become dashes. */
export function safeNamePart(text: string, fallback: string): string {
  const s = text.trim().replace(/\s+/g, "-").replace(/[^A-Za-z0-9.-]/g, "").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  return s || fallback;
}

/** {document}_{area}_{dpi}dpi_{YYYY-MM-DD_HHmm}.tif — in local time. A PDF is vector, so its name has no DPI: {document}_{area}_{date}.pdf. */
export function exportFileName(docName: string, areaLabel: string, dpi: number, when: Date, format: ExportFormat): string {
  const stamp = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}_${pad(when.getHours())}${pad(when.getMinutes())}`;
  const base = `${safeNamePart(docName, "Untitled")}_${safeNamePart(areaLabel, "Area")}`;
  return format === "pdf" ? `${base}_${stamp}.pdf` : `${base}_${dpi}dpi_${stamp}.tif`;
}

/** Images in a PDF are kept at up to this many pixels per printed inch when "downsample" is on. */
export const PDF_IMAGE_DPI = 300;

export function areaLabel(kind: AreaKind, sizes: string[] = []): string {
  if (kind === "page") return "All-sizes";
  if (kind === "selection") return "Selection";
  return sizes.length ? sizes.join("-") : "No-size";
}

/** The smallest box around all the given boxes, or null if there are none. */
export function unionRects(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  let l = Infinity;
  let t = Infinity;
  let r = -Infinity;
  let b = -Infinity;
  for (const q of rects) {
    l = Math.min(l, q.x);
    t = Math.min(t, q.y);
    r = Math.max(r, q.x + q.w);
    b = Math.max(b, q.y + q.h);
  }
  return { x: l, y: t, w: r - l, h: b - t };
}

export const rectsTouch = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The export area for the chosen sizes: everything belonging to those sizes, bleed included. */
export function sizesArea(blocks: { size: string; rect: Rect }[], sizes: string[]): Rect | null {
  return unionRects(blocks.filter((b) => sizes.includes(b.size)).map((b) => b.rect));
}

/** Where a point lands after the export is mirrored left-right inside its area. */
export function mirrorX(x: number, area: Pick<Rect, "x" | "w">): number {
  return 2 * area.x + area.w - x;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(bytes >= 1e7 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds - m * 60);
  return s ? `${m} min ${s} s` : `${m} min`;
}
