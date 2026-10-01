// Document geometry is ALWAYS stored in inches (Paper.js project units are
// inches). Display units only affect what the UI shows/accepts.

export type DisplayUnit = "in" | "cm" | "mm";

export const UNIT_LABEL: Record<DisplayUnit, string> = { in: "in", cm: "cm", mm: "mm" };

/** How many display units are in one inch. */
export const UNITS_PER_INCH: Record<DisplayUnit, number> = { in: 1, cm: 2.54, mm: 25.4 };

/** CSS reference: 96 CSS px = 1 inch at 100% zoom (before screen calibration). */
export const CSS_PX_PER_INCH = 96;

export const MIN_ZOOM_PCT = 1;
export const MAX_ZOOM_PCT = 3200;

export function toUnits(inches: number, unit: DisplayUnit): number {
  return inches * UNITS_PER_INCH[unit];
}

export function fromUnits(value: number, unit: DisplayUnit): number {
  return value / UNITS_PER_INCH[unit];
}

/** Fixed 3-decimal display, trimming "-0.000". */
export function formatUnits(inches: number, unit: DisplayUnit, decimals = 3): string {
  const v = toUnits(inches, unit);
  const s = v.toFixed(decimals);
  return s === `-${(0).toFixed(decimals)}` ? (0).toFixed(decimals) : s;
}

/** Parses user input like "12.5", "12.5 in", "30cm", "300 mm", "2'". Falls back to `unit`. */
export function parseLength(input: string, unit: DisplayUnit): number | null {
  const m = input.trim().toLowerCase().match(/^(-?\d*\.?\d+(?:e-?\d+)?)\s*(in|inch|inches|"|cm|mm|pt|px)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  switch (m[2]) {
    case "in":
    case "inch":
    case "inches":
    case '"':
      return n;
    case "cm":
      return n / 2.54;
    case "mm":
      return n / 25.4;
    case "pt":
      return n / 72;
    case "px":
      return n / CSS_PX_PER_INCH;
    default:
      return fromUnits(n, unit);
  }
}

/** Converts an absolute CSS/SVG length ("163.75in", "40cm", "12pt", "100px", "100") to inches. Unitless = px. */
export function cssLengthToInches(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = value.trim().match(/^(-?\d*\.?\d+(?:e-?\d+)?)\s*(in|cm|mm|pt|pc|px|q)?$/i);
  if (!m) return null; // % and em are not absolute
  const n = parseFloat(m[1]);
  switch ((m[2] || "px").toLowerCase()) {
    case "in":
      return n;
    case "cm":
      return n / 2.54;
    case "mm":
      return n / 25.4;
    case "q":
      return n / 101.6;
    case "pt":
      return n / 72;
    case "pc":
      return n / 6;
    default:
      return n / CSS_PX_PER_INCH;
  }
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
