// Client-side search/filter over the curated local dataset (colors.ts).
// Small enough to filter on every keystroke — no debouncing, no network call.
import { PANTONE_COLORS } from "./colors";
import type { PantoneColor, PantoneFamily } from "./types";

export function searchPantoneColors(query: string, family: PantoneFamily | "All" = "All"): PantoneColor[] {
  const q = query.trim().toLowerCase();
  return PANTONE_COLORS.filter((c) => {
    if (family !== "All" && c.family !== family) return false;
    if (!q) return true;
    return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
  });
}

/** Families actually present in the dataset, in dataset order — so the
 * filter row never shows an empty category. */
export function listPantoneFamilies(): PantoneFamily[] {
  const seen: PantoneFamily[] = [];
  for (const c of PANTONE_COLORS) {
    if (c.family && !seen.includes(c.family)) seen.push(c.family);
  }
  return seen;
}
