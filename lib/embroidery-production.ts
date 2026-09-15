// Print → Embroidery — shared types and deterministic production-estimate
// math. Nothing here calls AI: the analysis/conversion calls live in
// services/embroidery.ts. These numbers are honest heuristics (design area
// × a density-per-complexity constant), never a real digitization engine —
// every UI surface using them must label them "Estimated".

export type EmbroideryStyleId = "standard" | "satin" | "fill" | "running" | "3d-puff";

export interface EmbroideryStyleOption {
  id: EmbroideryStyleId;
  label: string;
  /** How this style is actually achieved in V1 — always via the AI
   * generation prompt, never a distinct technical stitch algorithm. Shown
   * in the UI so the limitation is explicit rather than implied. */
  technique: string;
}

export const EMBROIDERY_STYLES: EmbroideryStyleOption[] = [
  { id: "standard", label: "Standard", technique: "Satin + Fill" },
  { id: "satin", label: "Satin Stitch", technique: "Satin" },
  { id: "fill", label: "Fill Stitch", technique: "Fill (Tatami)" },
  { id: "running", label: "Running Stitch", technique: "Running" },
  { id: "3d-puff", label: "3D / Puff", technique: "3D Puff + Fill" },
];

export type PlacementId = "left-chest" | "right-chest" | "pocket" | "sleeve" | "back" | "custom";

export interface PlacementOption {
  id: PlacementId;
  label: string;
  /** Reference size at 100% scale — a typical real-world garment
   * measurement for this placement, not derived from the actual photo
   * (V1 has no garment-measurement detection). */
  baseWidthMm: number;
  baseHeightMm: number;
  /** Default quick-preview overlay position, as % of the garment image's
   * width/height — an approximation, not anatomically detected. */
  previewTop: number;
  previewLeft: number;
}

export const PLACEMENT_OPTIONS: PlacementOption[] = [
  { id: "left-chest", label: "Left Chest", baseWidthMm: 90, baseHeightMm: 70, previewTop: 28, previewLeft: 58 },
  { id: "right-chest", label: "Right Chest", baseWidthMm: 90, baseHeightMm: 70, previewTop: 28, previewLeft: 30 },
  { id: "pocket", label: "Pocket", baseWidthMm: 70, baseHeightMm: 70, previewTop: 42, previewLeft: 30 },
  { id: "sleeve", label: "Sleeve", baseWidthMm: 80, baseHeightMm: 60, previewTop: 32, previewLeft: 12 },
  { id: "back", label: "Back", baseWidthMm: 250, baseHeightMm: 200, previewTop: 25, previewLeft: 30 },
  { id: "custom", label: "Custom", baseWidthMm: 100, baseHeightMm: 100, previewTop: 35, previewLeft: 40 },
];

/** The decoration/production method applied to the artwork. Embroidery was
 * the only technique this module ever supported; the print techniques below
 * reuse every other piece of state (thread/color list, placement, garment
 * preview, save/undo/export) unchanged — only the AI guidance and the
 * production-facing labels differ per technique (see DECORATION_TECHNIQUES). */
export type DecorationTechnique = "EMBROIDERY" | "SCREEN_PRINT" | "HD_PRINT" | "PUFF_PRINT";

export interface DecorationTechniqueConfig {
  id: DecorationTechnique;
  label: string;
  description: string;
  /** Appended to the AI conversion/refinement prompt as the surface
   * treatment to render. Never touches artwork identity/placement/
   * proportions — see buildConversionPrompt in services/embroidery.ts. */
  aiGuidance: string;
  /** Heading for the shared color list under this technique — "Thread
   * Colors" only really describes embroidery; print techniques reuse the
   * exact same ThreadColor state as a color/Pantone reference instead. */
  colorLabel: string;
  /** Shown in the Production panel / export as "Decoration Technique: <label>". */
  productionLabel: string;
  /** Print techniques only — an honest, non-embroidery production note
   * (see computePrintProductionSpec). Embroidery keeps its own real
   * stitch/backing estimate from computeProductionSpec instead. */
  productionNote?: string;
}

export const DECORATION_TECHNIQUES: Record<DecorationTechnique, DecorationTechniqueConfig> = {
  EMBROIDERY: {
    id: "EMBROIDERY",
    label: "Embroidery",
    description: "Stitched embroidery concept with thread texture and depth.",
    aiGuidance:
      "Render it as if machine-embroidered on fabric: visible thread texture, stitched edges, raised fill areas, subtle embroidery depth and realistic thread sheen.",
    colorLabel: "Thread Colors",
    productionLabel: "Embroidery",
  },
  SCREEN_PRINT: {
    id: "SCREEN_PRINT",
    label: "Screen Print",
    description: "Flat ink print with clean solid shapes and crisp edges.",
    aiGuidance:
      "Render it as a realistic screen-printed design: flat ink appearance, clean solid shapes, crisp edges, limited/controlled color separations, ink sitting on the fabric surface. Do not add embroidery stitching, thread/fiber texture, or a raised 3D puff effect.",
    colorLabel: "Print Colors",
    productionLabel: "Screen Print",
    productionNote:
      "Estimated color separations are based on the selected colors — not a certified print-ready separation file.",
  },
  HD_PRINT: {
    id: "HD_PRINT",
    label: "HD Print",
    description: "High-resolution, detailed print with crisp typography.",
    aiGuidance:
      "Render it as a high-resolution, highly detailed printed design: sharp fine details, crisp typography, smooth gradients where appropriate, realistic ink/print texture integrated with the fabric. Do not render this as embroidery, a raised/puff print, or stitching.",
    colorLabel: "Print Colors",
    productionLabel: "HD Print",
    productionNote: "High-resolution detail is a rendering treatment — actual print resolution depends on your production printer/RIP workflow.",
  },
  PUFF_PRINT: {
    id: "PUFF_PRINT",
    label: "Puff Print",
    description: "Raised, dimensional print with a soft 3D foam effect.",
    aiGuidance:
      "Render it as a raised, dimensional puff-print design: a soft 3D foam effect, elevated soft edges, and realistic shadows/highlights caused by the raised ink sitting above the fabric surface. This is still a print, not embroidery — do not generate stitches, thread patterns, or a woven fabric texture.",
    colorLabel: "Print Colors",
    productionLabel: "Puff Print",
    productionNote: "Raised/puff surface effect is a rendering treatment — actual foam height and finish depend on your production puff-print process.",
  },
};

export const DEFAULT_DECORATION_TECHNIQUE: DecorationTechnique = "EMBROIDERY";

/** Old saved settings predate this field entirely; anything else unrecognized
 * also falls back to Embroidery — the only technique this module supported
 * before this feature, so it's the correct default for both cases. */
export function normalizeDecorationTechnique(raw: unknown): DecorationTechnique {
  return raw === "SCREEN_PRINT" || raw === "HD_PRINT" || raw === "PUFF_PRINT" || raw === "EMBROIDERY" ? raw : DEFAULT_DECORATION_TECHNIQUE;
}

export type GarmentTypeId = "t-shirt" | "hoodie" | "sweatshirt" | "polo" | "jacket" | "cap" | "other";

export const GARMENT_TYPES: { id: GarmentTypeId; label: string }[] = [
  { id: "t-shirt", label: "T-Shirt" },
  { id: "hoodie", label: "Hoodie" },
  { id: "sweatshirt", label: "Sweatshirt" },
  { id: "polo", label: "Polo" },
  { id: "jacket", label: "Jacket" },
  { id: "cap", label: "Cap" },
  { id: "other", label: "Other" },
];

/** Curated named palette for quick-adding thread colors. Real, fixed hex
 * values — not AI-derived — used only to label/suggest, never to change
 * output. */
export const THREAD_COLOR_PALETTE: { name: string; hex: string }[] = [
  { name: "Black", hex: "#111111" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Navy", hex: "#1E3A8A" },
  { name: "Royal Blue", hex: "#2563EB" },
  { name: "Red", hex: "#DC2626" },
  { name: "Burgundy", hex: "#7F1D1D" },
  { name: "Green", hex: "#16A34A" },
  { name: "Forest Green", hex: "#14532D" },
  { name: "Yellow", hex: "#EAB308" },
  { name: "Orange", hex: "#EA580C" },
  { name: "Pink", hex: "#EC4899" },
  { name: "Purple", hex: "#7C3AED" },
  { name: "Brown", hex: "#78350F" },
  { name: "Grey", hex: "#6B7280" },
  { name: "Beige", hex: "#D6C7A1" },
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Labels an arbitrary hex (from the native color picker) with its closest
 * named color from the curated palette, purely by RGB distance — a real,
 * deterministic computation, not an AI guess. */
export function nearestThreadColorName(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  let best = THREAD_COLOR_PALETTE[0];
  let bestDist = Infinity;
  for (const c of THREAD_COLOR_PALETTE) {
    const [cr, cg, cb] = hexToRgb(c.hex);
    const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best.name;
}

export interface EmbroideryAnalysis {
  complexity: "Low" | "Medium" | "High";
  colors: string[];
  colorCount: number;
  fineDetails: "Low" | "Moderate" | "High";
  thinLines: boolean;
  textDetected: boolean;
  gradients: boolean;
  smallElements: boolean;
  suitability: "Poor" | "Fair" | "Good" | "Excellent";
  recommendations: string[];
}

/** A single thread color. `pantone*` fields are optional so plain
 * hex-only threads (native color picker, curated palette) keep working
 * unchanged — only colors added via the Pantone Shade Picker carry them. */
export interface ThreadColor {
  hex: string;
  pantoneCode?: string;
  pantoneName?: string;
  /** Fashion, Home + Interiors system — the only Pantone system this app curates. */
  pantoneSystem?: "FHI";
  /** Textile Paper Cotton. */
  pantoneSuffix?: "TCX";
}

/** No prior limit existed on thread-color count; kept here as the single
 * place to tune it rather than an arbitrary check scattered across the UI. */
export const MAX_THREAD_COLORS = 12;

export interface EmbroiderySettings {
  technique: DecorationTechnique;
  style: EmbroideryStyleId;
  threadColors: ThreadColor[];
  detailLevel: number; // 0-100, 0 = maximally simplified
  outline: boolean;
  fill: boolean;
}

export const DEFAULT_SETTINGS_FROM_ANALYSIS = (analysis: EmbroideryAnalysis): EmbroiderySettings => ({
  technique: DEFAULT_DECORATION_TECHNIQUE,
  style: "standard",
  threadColors: analysis.colors.slice(0, 8).map((hex) => ({ hex })),
  detailLevel: analysis.complexity === "High" ? 40 : analysis.complexity === "Medium" ? 60 : 80,
  outline: true,
  fill: true,
});

/** Accepts either the current ThreadColor[] shape or the old plain
 * hex-string[] shape (pre-Pantone saved designs) and returns the current
 * shape — so old EmbroideryDesign rows keep loading without a migration. */
export function normalizeThreadColors(raw: unknown): ThreadColor[] {
  if (!Array.isArray(raw)) return [];
  const out: ThreadColor[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      out.push({ hex: item });
    } else if (item && typeof item === "object" && typeof (item as { hex?: unknown }).hex === "string") {
      const c = item as Partial<ThreadColor>;
      out.push({
        hex: c.hex!,
        ...(c.pantoneCode ? { pantoneCode: c.pantoneCode } : {}),
        ...(c.pantoneName ? { pantoneName: c.pantoneName } : {}),
        ...(c.pantoneSystem ? { pantoneSystem: c.pantoneSystem } : {}),
        ...(c.pantoneSuffix ? { pantoneSuffix: c.pantoneSuffix } : {}),
      });
    }
  }
  return out;
}

/** Normalizes an EmbroiderySettings blob read back from the (Json)
 * database column — same backward-compatibility purpose as
 * normalizeThreadColors, applied to the whole settings object. */
export function normalizeEmbroiderySettings(raw: unknown): EmbroiderySettings | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<EmbroiderySettings> & { threadColors?: unknown; technique?: unknown };
  return {
    technique: normalizeDecorationTechnique(r.technique),
    style: (r.style as EmbroideryStyleId) ?? "standard",
    threadColors: normalizeThreadColors(r.threadColors),
    detailLevel: typeof r.detailLevel === "number" ? r.detailLevel : 60,
    outline: r.outline !== undefined ? Boolean(r.outline) : true,
    fill: r.fill !== undefined ? Boolean(r.fill) : true,
  };
}

/** How a single thread color should read in an AI prompt or an exported
 * production spec: Pantone code/name is the intended textile reference,
 * hex is only ever a screen approximation — never claimed as an exact
 * physical match. */
export function describeThreadColor(c: ThreadColor): string {
  return c.pantoneCode
    ? `${c.pantoneCode}${c.pantoneSuffix ? ` ${c.pantoneSuffix}` : ""} — ${c.pantoneName ?? "Unnamed"} (digital approx. ${c.hex})`
    : c.hex;
}

export interface ProductionSpec {
  widthMm: number;
  heightMm: number;
  threadColorCount: number;
  estimatedStitchCount: number;
  technique: string;
  complexity: "Low" | "Medium" | "High";
  backingRecommended: boolean;
  warnings: string[];
}

// Rough stitches-per-mm² by complexity — a real digitization engine derives
// this from actual stitch paths; this is an illustrative density constant
// only, always surfaced as "Estimated" in the UI.
const STITCH_DENSITY_PER_MM2: Record<ProductionSpec["complexity"], number> = {
  Low: 6,
  Medium: 10,
  High: 16,
};

/** Shared by both computeProductionSpec (embroidery) and
 * computePrintProductionSpec (print techniques) — placement/size math is
 * generic, not embroidery-specific. */
export function computeDesignSizeMm(placement: PlacementId, sizePercent: number): { widthMm: number; heightMm: number } {
  const base = PLACEMENT_OPTIONS.find((p) => p.id === placement) ?? PLACEMENT_OPTIONS[0];
  const scale = sizePercent / 100;
  return { widthMm: Math.round(base.baseWidthMm * scale), heightMm: Math.round(base.baseHeightMm * scale) };
}

export function computeProductionSpec(
  analysis: EmbroideryAnalysis,
  settings: EmbroiderySettings,
  placement: PlacementId,
  sizePercent: number
): ProductionSpec {
  const { widthMm, heightMm } = computeDesignSizeMm(placement, sizePercent);

  // Detail Level pulls estimated density toward the next complexity tier in
  // either direction, reflecting that more simplification (lower detail)
  // means fewer stitches than the raw AI-assessed complexity implies.
  const complexity = analysis.complexity;
  let density = STITCH_DENSITY_PER_MM2[complexity];
  if (settings.detailLevel < 40) density *= 0.7;
  else if (settings.detailLevel > 80) density *= 1.15;
  if (settings.style === "3d-puff") density *= 1.2;
  if (settings.style === "running") density *= 0.5;

  const estimatedStitchCount = Math.round(((widthMm * heightMm * density) / 100) * 100);
  const technique = EMBROIDERY_STYLES.find((s) => s.id === settings.style)?.technique ?? "Satin + Fill";

  const warnings: string[] = [];
  if (analysis.textDetected && (analysis.fineDetails === "High" || settings.detailLevel < 50)) {
    warnings.push("Fine text may lose clarity at this size and detail level.");
  }
  if (analysis.thinLines) {
    warnings.push("Very thin lines may need adjustment or thickening for clean stitching.");
  }
  if (analysis.fineDetails === "High" || analysis.smallElements) {
    warnings.push("High-detail areas may require simplification.");
  }
  if (analysis.gradients) {
    warnings.push("Gradients will be approximated as flat thread-color bands.");
  }

  const backingRecommended = complexity !== "Low" || widthMm * heightMm > 4000;

  return {
    widthMm,
    heightMm,
    threadColorCount: settings.threadColors.length,
    estimatedStitchCount,
    technique,
    complexity,
    backingRecommended,
    warnings,
  };
}

export interface PrintProductionSpec {
  decorationTechnique: DecorationTechnique;
  widthMm: number;
  heightMm: number;
  colorCount: number;
  note: string;
}

/** Production info for the print techniques (Screen Print / HD Print / Puff
 * Print) — deliberately much smaller than computeProductionSpec: there's no
 * real stitch/backing estimate for a print, and this app doesn't fabricate
 * one. Only size (generic placement math, same as embroidery) and the
 * selected color count are genuinely derivable; everything else is a single
 * honest, technique-specific note (see DECORATION_TECHNIQUES). */
export function computePrintProductionSpec(settings: EmbroiderySettings, placement: PlacementId, sizePercent: number): PrintProductionSpec {
  const { widthMm, heightMm } = computeDesignSizeMm(placement, sizePercent);
  return {
    decorationTechnique: settings.technique,
    widthMm,
    heightMm,
    colorCount: settings.threadColors.length,
    note: DECORATION_TECHNIQUES[settings.technique].productionNote ?? "",
  };
}
