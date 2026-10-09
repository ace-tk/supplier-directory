// Outfit Design — from one top or one bottom, generate a coordinated
// complete outfit. Pure (no "use server", no DB, no network) so the page,
// the server actions and the tests share one set of rules.

/** The two groups the matching garment can come from. */
export const OUTFIT_GROUPS = ["Upper", "Lower"] as const;
export type OutfitGroup = (typeof OUTFIT_GROUPS)[number];

/** The garment types offered for each group (what the matched piece will be). */
export const OUTFIT_CATEGORIES: Record<OutfitGroup, readonly string[]> = {
  Upper: ["Outerwear", "Short Sleeve", "Long Sleeve", "Sleeveless"],
  Lower: ["Shorts", "Short Skirt", "Long Skirt", "Trousers"],
};

export type OutfitCategory = { group: OutfitGroup; name: string };

export const isOutfitGroup = (v: unknown): v is OutfitGroup => typeof v === "string" && (OUTFIT_GROUPS as readonly string[]).includes(v);
export const isOutfitCategory = (group: unknown, name: unknown): boolean => isOutfitGroup(group) && typeof name === "string" && OUTFIT_CATEGORIES[group].includes(name);

/** "Lower / Short Skirt" */
export const outfitCategoryLabel = (c: OutfitCategory) => `${c.group} / ${c.name}`;

export type OutfitMode = "standard" | "professional";

export const OUTFIT_MODES: { id: OutfitMode; label: string; hint: string; quality: "medium" | "high" }[] = [
  { id: "standard", label: "Standard", hint: "Fast, good-quality result.", quality: "medium" },
  { id: "professional", label: "Professional", hint: "Highest detail and fabric accuracy. Slower.", quality: "high" },
];

export const isOutfitMode = (v: unknown): v is OutfitMode => v === "standard" || v === "professional";
export const outfitQuality = (m: OutfitMode) => OUTFIT_MODES.find((x) => x.id === m)!.quality;

/** Longest side, in pixels, an upload is reduced to in the browser before it is sent. */
export const OUTFIT_UPLOAD_MAX_PX = 1536;

export const OUTFIT_ANALYSIS_SYSTEM_PROMPT = [
  "You are a senior fashion stylist looking at a photo of ONE garment that will be the starting point of an outfit.",
  "Describe it factually and concisely, in under 90 words: whether it is a top (upper body) or a bottom (lower body) and exactly what it is;",
  "silhouette, length and fit; colour palette; fabric and texture; print or pattern; signature details (collar, buttons, pleats, trims, hardware); and the overall mood and season.",
  "End with one line starting 'Garment:' that names it in a few words. No preamble, no advice.",
].join(" ");

/** What the uploaded piece is, for the prompt. The analysis decides; this is the safe fallback. */
export function describeSourceWorn(analysis: string): "top" | "bottom" | "garment" {
  const a = analysis.toLowerCase();
  const top = /\b(top|shirt|blouse|blazer|jacket|coat|cardigan|sweater|hoodie|tee|t-shirt|vest|kurta|tunic|bodysuit)\b/.test(a);
  const bottom = /\b(skirt|trousers|pants|jeans|shorts|leggings|culottes|palazzo)\b/.test(a);
  if (top && !bottom) return "top";
  if (bottom && !top) return "bottom";
  return "garment";
}

export interface OutfitPromptInput {
  match: OutfitCategory;
  mode: OutfitMode;
  /** The stylist's read of the uploaded garment (from OUTFIT_ANALYSIS_SYSTEM_PROMPT). */
  analysis: string;
}

/**
 * The generation prompt: ONE image of a complete outfit — the uploaded
 * garment exactly as photographed, plus one newly designed matching piece
 * of the chosen type — shown as a clean flat product presentation.
 */
export function buildOutfitPrompt(input: OutfitPromptInput): string {
  const source = describeSourceWorn(input.analysis);
  const piece = input.match.name.toLowerCase();
  const kind = input.match.group === "Upper" ? "top" : "bottom";
  return [
    `The attached photo shows one ${source === "garment" ? "garment" : source} that is the starting point of an outfit.`,
    `About it: ${input.analysis.trim()}`,
    `Design ONE matching ${piece} (a ${kind}, category "${outfitLabelOf(input.match)}") that coordinates with it, and show the two pieces together as one complete, wearable outfit.`,
    "The original garment must appear EXACTLY as in the photo: same design, shape, colour, fabric, print and every detail. Do not redesign, recolour or simplify it.",
    `The new ${piece} must be a genuinely different garment from the original (not a copy and not the same piece repeated), designed to go with it: a harmonised colour story, compatible fabric and texture, matching mood, season and level of formality, and flattering proportions next to the original.`,
    "Present the outfit as a clean product image: both garments laid flat or on an invisible ghost mannequin, arranged as they would be worn (top above bottom), straight on, centred, fully inside the frame, on a plain light neutral background. No person, no model, no hanger, no props, no shoes or accessories.",
    input.mode === "professional"
      ? "Professional quality: crisp stitching, seams, hems and trims; true-to-life fabric weave, drape and sheen; accurate proportions and symmetry; no distortions or invented details."
      : "Clean, realistic, commercial product quality.",
    "No text, no numbers, no labels, no captions, no logos, no watermarks, no borders.",
  ].join(" ");
}

const outfitLabelOf = (c: OutfitCategory) => outfitCategoryLabel(c);

/** Checks what a generation is asked for; returns a message for the user if something is wrong. */
export function validateOutfitRequest(input: { imageCount: number; group: unknown; category: unknown; mode: unknown }): string | null {
  if (!(input.imageCount >= 1)) return "Upload a style image.";
  if (input.imageCount > 1) return "Upload one style image at a time.";
  if (!isOutfitCategory(input.group, input.category)) return "Choose a matching category.";
  if (!isOutfitMode(input.mode)) return "Choose a generation mode.";
  return null;
}
