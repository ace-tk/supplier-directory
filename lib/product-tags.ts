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
  Cotton: "bg-mint text-mint-ink",
  Linen: "bg-butter text-butter-ink",
  Silk: "bg-lav text-lav-ink",
  Denim: "bg-sky text-sky-ink",
  Leather: "bg-peach text-peach-ink",
  Manufacturer: "bg-lav text-lav-ink",
  Wholesaler: "bg-sky text-sky-ink",
  Exporter: "bg-lav text-lav-ink",
  "Export Quality": "bg-sky text-sky-ink",
  "Ready Stock": "bg-mint text-mint-ink",
  "Best Seller": "bg-rose text-rose-ink",
  Trending: "bg-rose text-rose-ink",
  Premium: "bg-butter text-butter-ink",
  Sustainable: "bg-mint text-mint-ink",
  Wholesale: "bg-lav text-lav-ink",
};

export function getTagColor(tag: string): string {
  if (TAG_COLORS[tag]) return TAG_COLORS[tag];
  if (tag.startsWith("MOQ")) return "bg-rose text-rose-ink";
  return "bg-secondary text-secondary-foreground";
}
