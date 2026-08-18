import { Product } from "@/types/product";

export type ShopMediaKind = "front" | "back" | "side" | "labels";

export type ShopMediaOption = {
  kind: ShopMediaKind;
  label: string;
  src: string;
};

const VIEW_LABELS: { kind: ShopMediaKind; label: string }[] = [
  { kind: "front", label: "Front" },
  { kind: "back", label: "Back" },
  { kind: "side", label: "Side" },
  { kind: "labels", label: "Labels" },
];

/** Maps sequential product.images to Front/Back/Side/Labels by position —
 * there is no per-image "view" field in the schema, so this is the only
 * honest mapping available. Missing slots are simply omitted, never
 * padded with placeholder/fake images. No "Video" option is ever produced
 * here since Product has no real video field. */
export function getShopMediaOptions(product: Pick<Product, "images">): ShopMediaOption[] {
  const options: ShopMediaOption[] = [];
  product.images.forEach((src, index) => {
    if (!src || index >= VIEW_LABELS.length) return;
    const view = VIEW_LABELS[index];
    options.push({ kind: view.kind, label: view.label, src });
  });
  return options;
}

/** Last significant word of the product name, singularized, for
 * "Design your own {kind}" / "Manufacture your own {kind}". */
export function getProductKindLabel(name: string): string {
  const cleaned = name
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  const last = words[words.length - 1] ?? name;
  const lower = last.toLowerCase();
  if (lower.endsWith("ies") && lower.length > 4) return `${lower.slice(0, -3)}y`;
  if (lower.endsWith("ses") || lower.endsWith("xes") || lower.endsWith("zes")) return lower.slice(0, -2);
  if (lower.endsWith("s") && !lower.endsWith("ss") && lower.length > 3) return lower.slice(0, -1);
  return lower;
}

export function formatCompactCount(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v.toFixed(v < 10 ? 1 : 0)}M`;
  }
  if (n >= 1000) {
    const v = n / 1000;
    return `${v.toFixed(v < 10 ? 1 : 0)}K`;
  }
  return String(n);
}

const SIZE_TOKEN = /^(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|\d{2,3})$/i;

/** Only parses sizes explicitly listed in the product's free-text
 * specifications field (e.g. "Sizes: S, M, L, XL"). Returns [] — never a
 * fabricated S/M/L/XL/XXL — when no such text exists. */
export function parseSizesFromSpecifications(specifications: string | null | undefined): string[] {
  if (!specifications) return [];
  const match = specifications.match(/sizes?\s*[:\-–]\s*([^\n.]+)/i);
  if (!match) return [];
  return match[1]
    .split(/[,/|]/)
    .map((s) => s.trim())
    .filter((s) => SIZE_TOKEN.test(s))
    .map((s) => s.toUpperCase());
}

const NAMED_COLORS: Record<string, string> = {
  black: "#111111",
  white: "#f5f5f5",
  red: "#c0392b",
  blue: "#2980b9",
  navy: "#1b365d",
  green: "#1e8449",
  beige: "#d4c4a8",
  brown: "#6e4b3a",
  grey: "#7f8c8d",
  gray: "#7f8c8d",
  pink: "#d98880",
  yellow: "#d4ac0d",
  orange: "#d35400",
  purple: "#7d3c98",
  cream: "#f5e6c8",
  maroon: "#6e2c2c",
  olive: "#6b8e23",
  khaki: "#c3b091",
};

export type ShopColorSwatch = { name: string; hex: string };

/** Only parses colors explicitly listed in specifications (e.g.
 * "Colors: Black, Navy, Olive"). Returns [] when no such text exists —
 * never invents a default palette. */
export function parseColorsFromSpecifications(specifications: string | null | undefined): ShopColorSwatch[] {
  if (!specifications) return [];
  const match = specifications.match(/colou?rs?\s*[:\-–]\s*([^\n.]+)/i);
  if (!match) return [];
  const seen = new Set<string>();
  const out: ShopColorSwatch[] = [];
  for (const raw of match[1].split(/[,/|]/)) {
    const name = raw.trim();
    if (!name) continue;
    const hexMatch = name.match(/#([0-9a-f]{3,8})/i);
    const key = name.replace(/#\S+/, "").trim().toLowerCase() || name;
    if (seen.has(key)) continue;
    seen.add(key);
    const hex = hexMatch ? `#${hexMatch[1]}` : NAMED_COLORS[key];
    if (!hex) continue;
    out.push({ name: key, hex });
  }
  return out;
}

/** Design Your Own / Manufacture Your Own live under CatalogRow-based
 * routes, one variant per portal — Shop itself is only reachable from
 * admin/buyer today, so this always resolves to a real route. */
export function productBasePath(role: string | undefined): string {
  if (role === "SUPPLIER") return "/supplier/product";
  if (role === "FREELANCER") return "/freelancer/product";
  return "/buyer/product";
}

export function whatsappHref(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}
