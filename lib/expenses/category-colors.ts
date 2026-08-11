import type { ExpenseCategory } from "@/types/expense";

export interface CategoryColor {
  bg: string;
  text: string;
  dot: string;
}

// Fixed, stable palette — one color per system category, never reassigned.
const SYSTEM_CATEGORY_COLORS: Record<ExpenseCategory, CategoryColor> = {
  SHIPPING: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
  TRAVEL: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", dot: "bg-violet-500" },
  PACKAGING: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  TRANSPORTATION: { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", dot: "bg-cyan-500" },
  SAMPLES: { bg: "bg-pink-500/10", text: "text-pink-600 dark:text-pink-400", dot: "bg-pink-500" },
  MARKETING: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", dot: "bg-orange-500" },
  FREELANCER: { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400", dot: "bg-teal-500" },
  OFFICE: { bg: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", dot: "bg-indigo-500" },
  MISCELLANEOUS: { bg: "bg-slate-500/10", text: "text-slate-600 dark:text-slate-400", dot: "bg-slate-500" },
  OTHER: { bg: "bg-neutral-500/10", text: "text-neutral-600 dark:text-neutral-400", dot: "bg-neutral-500" },
};

// Distinct from the system palette above — custom categories hash into this
// set so they never visually collide with a fixed system color.
const CUSTOM_PALETTE: CategoryColor[] = [
  { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", dot: "bg-rose-500" },
  { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  { bg: "bg-sky-500/10", text: "text-sky-600 dark:text-sky-400", dot: "bg-sky-500" },
  { bg: "bg-fuchsia-500/10", text: "text-fuchsia-600 dark:text-fuchsia-400", dot: "bg-fuchsia-500" },
  { bg: "bg-lime-500/10", text: "text-lime-600 dark:text-lime-400", dot: "bg-lime-500" },
  { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", dot: "bg-yellow-500" },
  { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
  { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", dot: "bg-purple-500" },
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
