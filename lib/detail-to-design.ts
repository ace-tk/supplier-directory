// Detail to Design — turn a neckline, sleeve, pocket or other detail
// reference into several apparel concepts. Pure (no "use server", no DB, no
// network) so the page, the server actions and the tests share one set of
// rules. The category list, output formats and grid layout are the same as
// Hit Collection, so they are reused rather than copied.

import {
  FORMAT_INSTRUCTION,
  HIT_DEFAULT_GRID,
  HIT_MAX_GRID,
  HIT_MIN_GRID,
  HIT_STYLE_CATEGORIES,
  HIT_UPLOAD_MAX_PX,
  clampGrid,
  describeLayout,
  gridLayout,
  isHitOutputFormat,
  isHitStyleCategory,
  type HitOutputFormat,
  type HitStyleCategory,
} from "@/lib/hit-collection";

export {
  HIT_DEFAULT_GRID as DETAIL_DEFAULT_COUNT,
  HIT_MAX_GRID as DETAIL_MAX_COUNT,
  HIT_MIN_GRID as DETAIL_MIN_COUNT,
  HIT_STYLE_CATEGORIES as DETAIL_STYLE_CATEGORIES,
  HIT_UPLOAD_MAX_PX as DETAIL_UPLOAD_MAX_PX,
  clampGrid as clampDetailCount,
  isHitOutputFormat as isDetailOutputFormat,
  isHitStyleCategory as isDetailStyleCategory,
};
export type { HitOutputFormat as DetailOutputFormat, HitStyleCategory as DetailStyleCategory };
export { HIT_OUTPUT_FORMATS as DETAIL_OUTPUT_FORMATS } from "@/lib/hit-collection";

/** Longest "Reference Brand or Style" text accepted. */
export const DETAIL_REFERENCE_MAX_CHARS = 300;

/** One-tap ideas for the "Reference Brand or Style" box. They describe a look, not a trademark. */
export const DETAIL_REFERENCE_IDEAS = ["Minimal and clean", "Romantic and soft", "Streetwear", "Festive ethnic", "Office smart", "Resort holiday"] as const;

export const DETAIL_ANALYSIS_SYSTEM_PROMPT = [
  "You are a senior fashion designer studying a reference photo of ONE garment detail",
  "(for example a neckline, collar, sleeve, cuff, pocket, hem, closure, trim, embroidery or panel).",
  "Describe it factually and concisely, in under 90 words: which detail it is and where it sits on a garment;",
  "its exact shape, construction and proportions; the fabric, texture and colour; any stitching, trims or hardware.",
  "End with one line starting 'Detail:' that names it in a few words. No preamble, no advice.",
].join(" ");

export interface DetailPromptInput {
  styleCategory: HitStyleCategory;
  outputFormat: HitOutputFormat;
  count: number;
  /** The design read of the detail (from DETAIL_ANALYSIS_SYSTEM_PROMPT). */
  analysis: string;
  /** Optional free text: a brand, mood or style to lean towards. */
  referenceStyle?: string;
}

/**
 * The generation prompt: ONE image holding a grid of different garments in
 * the chosen category that all feature the uploaded detail. The photo
 * carries the real pixels; the analysis names what must be reproduced.
 */
export function buildDetailToDesignPrompt(input: DetailPromptInput): string {
  const n = clampGrid(input.count);
  const layout = gridLayout(n, input.outputFormat);
  const style = (input.referenceStyle ?? "").trim();
  return [
    `The attached photo shows one garment DETAIL (a close-up reference), not a full outfit. The garments to design are in the category "${input.styleCategory}".`,
    `Design ${n === 1 ? "one new apparel concept" : `${n} new, clearly different apparel concepts`} in the "${input.styleCategory}" category, each one built around this exact detail.`,
    `The detail: ${input.analysis.trim()}`,
    "Reproduce the detail faithfully in every concept — the same shape, construction, proportions, texture and finish — and make it the hero feature of the garment.",
    n === 1
      ? "Everything else on the garment (silhouette, length, fabric, colour) is for you to design so it looks like a complete, wearable, commercial style."
      : "Everything else (silhouette, length, fabric, colour, proportions) should differ from concept to concept so each looks like a genuinely different design, not a recolour. Do not repeat the same idea twice.",
    style ? `Style direction to lean towards: ${style}. Take the mood and design language from it; do not copy any logo, name or branding.` : "Choose a coherent, commercially appealing style direction.",
    `Every concept must be a ${input.styleCategory === "Sets" ? "set" : input.styleCategory.toLowerCase().replace(/s$/, "")} in the "${input.styleCategory}" category.`,
    FORMAT_INSTRUCTION[input.outputFormat],
    n === 1
      ? "Output a single image showing that one concept."
      : `Output ONE single image laid out as a clean contact sheet with exactly ${n} panels: ${describeLayout(layout)}. Every panel is the same size, shows exactly one complete concept fully inside its panel (nothing cropped), and is separated from its neighbours by a thin even white gutter.`,
    "No text, no numbers, no labels, no captions, no logos, no watermarks, no borders other than the gutters.",
    "Photorealistic, professional fashion design presentation quality, sharp garment details, accurate fabric rendering.",
  ].join(" ");
}

/** Checks what a generation is asked for; returns a message for the user if something is wrong. */
export function validateDetailRequest(input: { imageCount: number; styleCategory: unknown; outputFormat: unknown; count: unknown; referenceStyle?: unknown }): string | null {
  if (!(input.imageCount >= 1)) return "Upload a detail image.";
  if (input.imageCount > 1) return "Upload one detail image at a time.";
  if (!isHitStyleCategory(input.styleCategory)) return "Choose a style category.";
  if (!isHitOutputFormat(input.outputFormat)) return "Choose an output type.";
  const c = Number(input.count);
  if (!Number.isInteger(c) || c < HIT_MIN_GRID || c > HIT_MAX_GRID) return `Design count must be between ${HIT_MIN_GRID} and ${HIT_MAX_GRID}.`;
  if (typeof input.referenceStyle === "string" && input.referenceStyle.length > DETAIL_REFERENCE_MAX_CHARS) return `Reference brand or style must be at most ${DETAIL_REFERENCE_MAX_CHARS} characters.`;
  return null;
}
