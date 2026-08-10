/** Fixed GST/tax rate choices for Catalog products — never free-typed. */
export const GST_RATE_OPTIONS = [0, 5, 12, 18] as const;

/**
 * priceAfterGst is always server-derived from priceBeforeGst + gstPercent —
 * never hand-edited. Rounded to 2dp to match the money-display convention
 * used elsewhere (this model stays on plain Float, consistent with its
 * sibling fields; see lib/invoicing/calc.ts for the Decimal-based engine
 * used where money precision genuinely matters at scale).
 */
export function computeCatalogPriceAfterGst(priceBeforeGst: number, gstPercent: number): number {
  const result = priceBeforeGst * (1 + gstPercent / 100);
  return Math.round(result * 100) / 100;
}
