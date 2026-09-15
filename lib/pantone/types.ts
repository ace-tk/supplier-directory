// Pantone data layer — types only. See colors.ts for the licensing/data-
// sourcing rules that govern what may live in this module.

export type PantoneFamily = "Red" | "Orange" | "Yellow" | "Green" | "Blue" | "Purple" | "Pink" | "Brown" | "Gray" | "Neutral";

export interface PantoneColor {
  code: string;
  name: string;
  hex: string;
  family?: PantoneFamily;
  /** Fashion, Home + Interiors system. The only Pantone system this app curates data for. */
  system: "FHI";
  /** Textile Paper Cotton — the apparel/embroidery-relevant FHI format. */
  suffix: "TCX";
}
