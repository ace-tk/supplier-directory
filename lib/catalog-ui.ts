/** Fixed GST/tax rate choices for Catalog products — never free-typed. */
export const GST_RATE_OPTIONS = [0, 5, 12, 18] as const;

/**
 * Seed choices only — `CatalogRow.warehouse` is a plain string, not an
 * enum, so any other name typed via the Product module's Warehouse
 * combobox works without a schema change. Kept as a starting list per
 * Phase 1 of the warehouse feature.
 */
export const DEFAULT_WAREHOUSE_OPTIONS = ["Warehouse 1", "Warehouse 2"];

/** Standard apparel sizes offered as quick-pick chips; a custom size can
 * always be typed in addition to these. */
export const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL"];

/** Optional — only shown/set where a product's category makes it relevant. */
export const GENDER_OPTIONS = ["Men", "Women", "Unisex"];

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

// Characters chosen to avoid visually-ambiguous glyphs (0/O, 1/I) when a
// SKU is read off a label or packing slip.
const SKU_SUFFIX_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function skuSuffix(length = 5): string {
  let out = "";
  for (let i = 0; i < length; i++) out += SKU_SUFFIX_CHARS[Math.floor(Math.random() * SKU_SUFFIX_CHARS.length)];
  return out;
}

function skuPart(s: string | undefined): string {
  return (s ?? "").trim().replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase();
}

/**
 * Deterministic-shape (not AI) SKU generator — brand/category/product-name
 * initials plus a random collision-resistant suffix, checked against the
 * caller's already-known SKUs (their own catalog rows) and regenerated on
 * an actual collision rather than trusting randomness alone.
 */
export function generateProductSku(
  input: { brandName?: string; category?: string; productName?: string },
  existingSkus: string[] = []
): string {
  const base = [skuPart(input.brandName), skuPart(input.category), skuPart(input.productName)].filter(Boolean).join("-") || "PRD";
  const existing = new Set(existingSkus.map((s) => s.toUpperCase()));

  let sku = `${base}-${skuSuffix()}`;
  let attempts = 0;
  while (existing.has(sku.toUpperCase()) && attempts < 10) {
    sku = `${base}-${skuSuffix()}`;
    attempts++;
  }
  return sku;
}
