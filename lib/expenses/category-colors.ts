import type { ExpenseCategory } from "@/types/expense";

export interface CategoryColor {
  bg: string;
  text: string;
  dot: string;
}

// Fixed, stable palette — one color per system category, never reassigned.
const SYSTEM_CATEGORY_COLORS: Record<ExpenseCategory, CategoryColor> = {
  SHIPPING: { bg: "bg-sky", text: "text-sky-ink ", dot: "bg-blue-500" },
  TRAVEL: { bg: "bg-lav", text: "text-lav-ink ", dot: "bg-violet-500" },
  PACKAGING: { bg: "bg-butter", text: "text-butter-ink ", dot: "bg-amber-500" },
  TRANSPORTATION: { bg: "bg-sky", text: "text-sky-ink ", dot: "bg-cyan-500" },
  SAMPLES: { bg: "bg-rose", text: "text-rose-ink ", dot: "bg-pink-500" },
  MARKETING: { bg: "bg-peach", text: "text-peach-ink ", dot: "bg-orange-500" },
  FREELANCER: { bg: "bg-mint", text: "text-mint-ink ", dot: "bg-teal-500" },
  OFFICE: { bg: "bg-lav", text: "text-lav-ink ", dot: "bg-indigo-500" },
  MISCELLANEOUS: { bg: "bg-soft/10", text: "text-muted-foreground ", dot: "bg-soft" },
  OTHER: { bg: "bg-soft/10", text: "text-muted-foreground ", dot: "bg-soft" },
};

// Distinct from the system palette above — custom categories hash into this
// set so they never visually collide with a fixed system color.
const CUSTOM_PALETTE: CategoryColor[] = [
  { bg: "bg-rose", text: "text-rose-ink ", dot: "bg-rose-500" },
  { bg: "bg-mint", text: "text-mint-ink ", dot: "bg-emerald-500" },
  { bg: "bg-sky", text: "text-sky-ink ", dot: "bg-sky-500" },
  { bg: "bg-lav", text: "text-lav-ink ", dot: "bg-fuchsia-500" },
  { bg: "bg-sage", text: "text-sage-ink ", dot: "bg-lime-500" },
  { bg: "bg-butter", text: "text-butter-ink ", dot: "bg-yellow-500" },
  { bg: "bg-rose", text: "text-rose-ink ", dot: "bg-red-500" },
  { bg: "bg-lav", text: "text-lav-ink ", dot: "bg-purple-500" },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * The single color resolver for every category badge in the app (Expenses
 * table, form, detail, Reports/charts) — system categories get a stable
 * predefined color, custom categories get a color hashed deterministically
 * from their id (or name, if no id is known yet) so the same category
 * always renders the same color everywhere without a stored color column.
 */
export function getCategoryColor(input: {
  category: ExpenseCategory;
  customCategoryId?: string | null;
  customCategoryLabel?: string | null;
}): CategoryColor {
  const customKey = input.customCategoryId || input.customCategoryLabel;
  if (input.category === "OTHER" && customKey) {
    return CUSTOM_PALETTE[hashString(customKey) % CUSTOM_PALETTE.length];
  }
  return SYSTEM_CATEGORY_COLORS[input.category];
}
