import { Product } from "@/types/product";

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Public domain sample clip (Blender Foundation's "Big Buck Bunny"), used
// widely as an HTML5 <video> demo source — swap for a real supplier upload URL later.
const SAMPLE_VIDEO_URL = "https://www.w3schools.com/html/mov_bbb.mp4";

export function hasProductVideo(product: Pick<Product, "id">): boolean {
  return hashString(`${product.id}-video`) % 5 < 2; // ~40% of products
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for signature parity with a future per-product video URL
export function getProductVideoUrl(product: Pick<Product, "id">): string {
  return SAMPLE_VIDEO_URL;
}

export function getProductViews(product: Pick<Product, "id" | "savedCount">): number {
  const hash = hashString(`${product.id}-views`);
  return 800 + (hash % 24000) + product.savedCount * 3;
}

export function formatViews(n: number): string {
  if (n >= 1000) {
    const thousands = n / 1000;
    return `${thousands.toFixed(thousands < 10 ? 1 : 0)}K`;
  }
  return String(n);
}

export interface CountryViews {
  code: string;
  flag: string;
  country: string;
  views: number;
  percent: number;
}

const COUNTRY_WEIGHTS = [
  { code: "IN", flag: "🇮🇳", country: "India", weight: 50 },
  { code: "US", flag: "🇺🇸", country: "USA", weight: 17 },
  { code: "GB", flag: "🇬🇧", country: "UK", weight: 8 },
  { code: "AE", flag: "🇦🇪", country: "UAE", weight: 7 },
  { code: "CA", flag: "🇨🇦", country: "Canada", weight: 5 },
  { code: "AU", flag: "🇦🇺", country: "Australia", weight: 4 },
];

export function getViewsByCountry(product: Pick<Product, "id">, totalViews: number): CountryViews[] {
  const jittered = COUNTRY_WEIGHTS.map((c) => {
    const jitter = 0.8 + (hashString(`${product.id}-${c.code}`) % 40) / 100; // 0.8x - 1.2x
    return { ...c, adjWeight: c.weight * jitter };
  });
  const sumWeight = jittered.reduce((s, c) => s + c.adjWeight, 0);

  let allocated = 0;
  const results = jittered.map((c, i) => {
    const isLast = i === jittered.length - 1;
    const views = isLast ? totalViews - allocated : Math.round((c.adjWeight / sumWeight) * totalViews);
    allocated += views;
    return {
      code: c.code,
      flag: c.flag,
      country: c.country,
      views,
      percent: totalViews > 0 ? Math.round((views / totalViews) * 100) : 0,
    };
  });

  return results.sort((a, b) => b.views - a.views);
}

const SHIPPING_TERMS = [
  "FOB (Free On Board)",
  "CIF (Cost, Insurance & Freight)",
  "EXW (Ex Works)",
  "DDP (Delivered Duty Paid)",
];

const PAYMENT_TERMS = [
  "30% advance, 70% before shipment",
  "T/T in advance",
  "L/C at sight",
  "50% advance, balance on delivery",
  "Net 30 days",
];

export function getShippingTerms(product: Pick<Product, "id">): string {
  return SHIPPING_TERMS[hashString(`${product.id}-shipping`) % SHIPPING_TERMS.length];
}

export function getPaymentTerms(product: Pick<Product, "id">): string {
  return PAYMENT_TERMS[hashString(`${product.id}-payment`) % PAYMENT_TERMS.length];
}
