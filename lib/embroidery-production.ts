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

export interface EmbroiderySettings {
  style: EmbroideryStyleId;
  threadColors: string[];
  detailLevel: number; // 0-100, 0 = maximally simplified
  outline: boolean;
  fill: boolean;
}

export const DEFAULT_SETTINGS_FROM_ANALYSIS = (analysis: EmbroideryAnalysis): EmbroiderySettings => ({
  style: "standard",
  threadColors: analysis.colors.slice(0, 8),
  detailLevel: analysis.complexity === "High" ? 40 : analysis.complexity === "Medium" ? 60 : 80,
  outline: true,
  fill: true,
});

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

export function computeProductionSpec(
  analysis: EmbroideryAnalysis,
  settings: EmbroiderySettings,
  placement: PlacementId,
  sizePercent: number
): ProductionSpec {
  const base = PLACEMENT_OPTIONS.find((p) => p.id === placement) ?? PLACEMENT_OPTIONS[0];
  const scale = sizePercent / 100;
  const widthMm = Math.round(base.baseWidthMm * scale);
  const heightMm = Math.round(base.baseHeightMm * scale);

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
