// Lightweight keyword/regex heuristics to pre-fill structured fields from a
// buyer's free-text sourcing requirement. Not real NLP — good enough for a
// "detected" hint the admin can correct. Swap for a real extraction model
// or API later; call sites only depend on these function signatures.

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Footwear: ["sneaker", "shoe", "footwear", "loafer", "sandal", "boot"],
  Women: ["kurti", "dress", "gown", "women", "saree", "palazzo", "anarkali"],
  Men: ["hoodie", "jacket", "shirt", "men's", "mens", "trouser"],
  "Kids Wear": ["kids", "children", "child wear", "kidswear"],
  Accessories: ["handbag", "bag", "wallet", "belt", "accessor"],
  "Home Textiles": ["linen", "towel", "bedsheet", "curtain", "home textile"],
};

export function detectCategory(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return category;
  }
  return null;
}

export function detectQuantity(text: string): string | null {
  const match = text.match(/(\d[\d,]{0,7})\s*(pcs|pieces|units|pairs)?/i);
  if (!match) return null;
  return match[2] ? `${match[1]} ${match[2]}` : `${match[1]} units`;
}

export function detectBudget(text: string): string | null {
  const match = text.match(/(under|below|around|budget of)?\s*[₹$]\s?[\d,]+(\.\d+)?/i);
  return match ? match[0].trim() : null;
}

const COUNTRY_KEYWORDS: Record<string, string[]> = {
  India: ["india", "tiruppur", "delhi", "mumbai", "surat", "jaipur", "ludhiana", "tirupur"],
  China: ["china", "guangzhou", "shenzhen", "yiwu"],
  Bangladesh: ["bangladesh", "dhaka"],
  Vietnam: ["vietnam", "hanoi"],
};

export function detectCountry(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [country, keywords] of Object.entries(COUNTRY_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return country;
  }
  return null;
}
