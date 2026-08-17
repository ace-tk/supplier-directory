import { Product } from "@/types/product";

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getMoqNumber(product: Pick<Product, "moq">): number | null {
  if (!product.moq) return null;
  const match = product.moq.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

export function isExportQuality(product: Pick<Product, "country">): boolean {
  return !!product.country && product.country !== "India";
}

export function getPriceMin(product: Pick<Product, "priceRange">): number {
  if (!product.priceRange) return 0;
  const match = product.priceRange.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

export function isReadyStock(product: Pick<Product, "id">): boolean {
  return hashString(product.id + "stock") % 2 === 0;
}

/**
 * Real-data-only tags — every entry here must be a direct, honest
 * derivation of an actual Product/SupplierListing field. Previously this
 * also pushed "Ready Stock"/"Premium"/"Sustainable" (each gated by a
 * hash of product.id, i.e. fabricated) and an unconditional "Wholesale"
 * on every single product — all removed. Best Seller/Trending stay: they
 * read Product.savedCount, which is now a genuinely live counter (see
 * services/shop.ts toggleSavedProductAction).
 */
export function getProductTags(product: Product): string[] {
  const tags: string[] = [];

  if (product.material) tags.push(product.material.split(" ")[0]);
  if (product.supplier?.supplierType) tags.push(product.supplier.supplierType);
  if (isExportQuality(product)) tags.push("Export Quality");

  const moq = getMoqNumber(product);
  if (moq !== null && moq < 100) tags.push(`MOQ ${moq}`);

  if (product.savedCount > 480) tags.push("Best Seller");
  else if (product.savedCount > 320) tags.push("Trending");

  return Array.from(new Set(tags)).slice(0, 6);
}

const TAG_COLORS: Record<string, string> = {
  Cotton: "bg-emerald-500/15 text-emerald-400",
  Linen: "bg-amber-500/15 text-amber-400",
  Silk: "bg-fuchsia-500/15 text-fuchsia-400",
  Denim: "bg-blue-500/15 text-blue-400",
  Leather: "bg-orange-500/15 text-orange-400",
  Manufacturer: "bg-indigo-500/15 text-indigo-400",
  Wholesaler: "bg-cyan-500/15 text-cyan-400",
  Exporter: "bg-violet-500/15 text-violet-400",
  "Export Quality": "bg-sky-500/15 text-sky-400",
  "Ready Stock": "bg-teal-500/15 text-teal-400",
  "Best Seller": "bg-rose-500/15 text-rose-400",
  Trending: "bg-red-500/15 text-red-400",
  Premium: "bg-yellow-500/15 text-yellow-400",
  Sustainable: "bg-green-500/15 text-green-400",
  Wholesale: "bg-purple-500/15 text-purple-400",
};

export function getTagColor(tag: string): string {
  if (TAG_COLORS[tag]) return TAG_COLORS[tag];
  if (tag.startsWith("MOQ")) return "bg-pink-500/15 text-pink-400";
  return "bg-secondary text-secondary-foreground";
}
