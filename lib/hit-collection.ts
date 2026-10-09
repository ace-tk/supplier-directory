// Hit Collection Proposal — the options, the grid layout and the prompts.
// Pure (no "use server", no DB, no network), so the page, the server
// actions and any test share exactly the same rules.

/** How many bestseller photos can be uploaded for one proposal. */
export const HIT_MAX_IMAGES = 9;
export const HIT_MIN_GRID = 1;
export const HIT_MAX_GRID = 9;
export const HIT_DEFAULT_GRID = 4;

/** Longest side, in pixels, an upload is reduced to in the browser before it is sent (keeps nine photos well inside the request limit). */
export const HIT_UPLOAD_MAX_PX = 1536;

export const HIT_STYLE_CATEGORIES = ["Tops", "Bottoms", "Dresses", "Sets", "Outerwear", "Innerwear", "Hats", "Shoes", "Bags"] as const;
export type HitStyleCategory = (typeof HIT_STYLE_CATEGORIES)[number];

export type HitOutputFormat = "on-model" | "flat-lay" | "original";

export const HIT_OUTPUT_FORMATS: { id: HitOutputFormat; label: string; hint: string }[] = [
  { id: "on-model", label: "On-Model Image", hint: "Every variation worn by a model, full length, studio background." },
  { id: "flat-lay", label: "Flat-Lay Image", hint: "Every variation laid flat on a plain background, no person." },
  { id: "original", label: "Keep Original Image Effect", hint: "Same presentation, pose and background as your bestseller photo." },
];

export const isHitStyleCategory = (v: unknown): v is HitStyleCategory => typeof v === "string" && (HIT_STYLE_CATEGORIES as readonly string[]).includes(v);
export const isHitOutputFormat = (v: unknown): v is HitOutputFormat => v === "on-model" || v === "flat-lay" || v === "original";
export const clampGrid = (n: number) => Math.min(HIT_MAX_GRID, Math.max(HIT_MIN_GRID, Math.round(Number.isFinite(n) ? n : HIT_DEFAULT_GRID)));

export type HitImageSize = "1024x1024" | "1024x1536" | "1536x1024";

export interface HitGridLayout {
  /** Panels in each row, top to bottom — e.g. [3, 2] for five variations. */
  rows: number[];
  cols: number;
  size: HitImageSize;
}

/**
 * How `count` variations are arranged in the one result image, and which
 * of the three image sizes the AI supports fits that arrangement best.
 * Flat-lays are roughly square; a garment on a model is tall, so on-model
 * grids get fewer, taller rows.
 */
export function gridLayout(count: number, format: HitOutputFormat): HitGridLayout {
  const n = clampGrid(count);
  const tall = format !== "flat-lay";
  const table: Record<number, { rows: number[]; tallSize: HitImageSize; flatSize: HitImageSize }> = {
    1: { rows: [1], tallSize: "1024x1536", flatSize: "1024x1024" },
    2: { rows: [2], tallSize: "1536x1024", flatSize: "1536x1024" },
    3: { rows: [3], tallSize: "1536x1024", flatSize: "1536x1024" },
    4: { rows: [2, 2], tallSize: "1024x1536", flatSize: "1024x1024" },
    5: { rows: [3, 2], tallSize: "1536x1024", flatSize: "1536x1024" },
    6: { rows: [3, 3], tallSize: "1024x1536", flatSize: "1536x1024" },
    7: { rows: [4, 3], tallSize: "1536x1024", flatSize: "1536x1024" },
    8: { rows: [4, 4], tallSize: "1536x1024", flatSize: "1536x1024" },
    9: { rows: [3, 3, 3], tallSize: "1024x1536", flatSize: "1024x1024" },
  };
  const t = table[n];
  return { rows: t.rows, cols: Math.max(...t.rows), size: tall ? t.tallSize : t.flatSize };
}

/** "2 rows × 2 columns", "one row of 3", "a top row of 3 and a bottom row of 2"… */
export function describeLayout(layout: HitGridLayout): string {
  const { rows } = layout;
  if (rows.length === 1) return rows[0] === 1 ? "a single panel filling the image" : `one row of ${rows[0]} equal panels side by side`;
  if (rows.every((r) => r === rows[0])) return `${rows.length} rows × ${rows[0]} columns of equal panels`;
  return `${rows.length} rows: ${rows.map((r, i) => `row ${i + 1} has ${r} panels`).join(", ")}, each row centred`;
}

export const HIT_ANALYSIS_SYSTEM_PROMPT = [
  "You are a senior fashion designer analysing a bestselling style so a design team can extend it into a collection.",
  "Look at the photo(s) — they all show the SAME bestselling item — and describe its design language factually and concisely, in under 120 words:",
  "item type and silhouette; fit and proportions; neckline / collar, sleeves, waist, hem and closures; signature details (panels, pleats, trims, hardware, stitching);",
  "fabric and texture; colour palette; print or pattern and where it sits; overall mood and target customer.",
  "End with one line starting 'Signature:' naming the two or three things that make this style recognisable. No preamble, no advice.",
].join(" ");

export const FORMAT_INSTRUCTION: Record<HitOutputFormat, string> = {
  "on-model":
    "Show each variation worn by a fashion model, full length, standing, facing the camera, on a plain light studio background. Use the same model (same face, hair, body and skin tone) in every panel, with consistent lighting and framing, so only the garment changes.",
  "flat-lay":
    "Show each variation as a clean flat-lay / ghost product shot: the item alone, laid flat and neatly arranged, seen straight on, on a plain light neutral background. No person, no mannequin, no hanger, no props.",
  original:
    "Keep the presentation of the reference photo in every panel: the same kind of shot, the same pose or arrangement, the same background and lighting as the bestseller image, so the result looks like it was photographed in the same session.",
};

export interface HitPromptInput {
  styleCategory: HitStyleCategory;
  outputFormat: HitOutputFormat;
  gridCount: number;
  /** The design-language read of the bestseller (from HIT_ANALYSIS_SYSTEM_PROMPT). */
  analysis: string;
  /** How many reference photos are attached. */
  imageCount: number;
}

/**
 * The generation prompt: ONE image holding a grid of variations that keep
 * the bestseller's design language. The reference photo(s) carry the real
 * pixels; the analysis text names what must not drift.
 */
export function buildHitCollectionPrompt(input: HitPromptInput): string {
  const n = clampGrid(input.gridCount);
  const layout = gridLayout(n, input.outputFormat);
  const item = input.styleCategory === "Sets" ? "set" : input.styleCategory.toLowerCase().replace(/s$/, "");
  return [
    `The attached ${input.imageCount > 1 ? `${input.imageCount} photos all show` : "photo shows"} one bestselling fashion item in the category "${input.styleCategory}".`,
    `Design a collection extension of it: ${n === 1 ? "one new style variation" : `${n} new, clearly different style variations`} that a customer would instantly recognise as belonging to the same collection as the bestseller.`,
    `Design language to preserve in every variation: ${input.analysis.trim()}`,
    "Keep the core of the bestseller: its overall silhouette family, fabric and texture, colour palette, signature details and mood.",
    n === 1
      ? "Change one or two secondary elements so it is a new style, not a copy — for example the neckline, sleeve, length, panel or print placement, trim or closure."
      : "Make each variation differ from the bestseller AND from the others by changing one or two secondary elements — for example the neckline, sleeve, length, panel or print placement, trim or closure. Do not simply recolour, and do not repeat the same idea twice.",
    `Every variation must stay a ${item} in the "${input.styleCategory}" category. Do not turn it into a different kind of item, and do not copy the bestseller unchanged.`,
    FORMAT_INSTRUCTION[input.outputFormat],
    n === 1
      ? "Output a single image showing that one variation."
      : `Output ONE single image laid out as a clean contact sheet with exactly ${n} panels: ${describeLayout(layout)}. Every panel is the same size, shows exactly one complete variation fully inside its panel (nothing cropped), and is separated from its neighbours by a thin even white gutter.`,
    "No text, no numbers, no labels, no captions, no logos, no watermarks, no borders other than the gutters.",
    "Photorealistic, professional fashion design presentation quality, sharp garment details, accurate fabric rendering.",
  ].join(" ");
}

/** Checks the settings a generation is asked for; returns a message for the user if something is wrong. */
export function validateHitRequest(input: { imageCount: number; styleCategory: unknown; outputFormat: unknown; gridCount: unknown }): string | null {
  if (!(input.imageCount >= 1)) return "Upload at least one bestseller image.";
  if (input.imageCount > HIT_MAX_IMAGES) return `Upload at most ${HIT_MAX_IMAGES} images.`;
  if (!isHitStyleCategory(input.styleCategory)) return "Choose a style category.";
  if (!isHitOutputFormat(input.outputFormat)) return "Choose an output format.";
  const g = Number(input.gridCount);
  if (!Number.isInteger(g) || g < HIT_MIN_GRID || g > HIT_MAX_GRID) return `Grid count must be between ${HIT_MIN_GRID} and ${HIT_MAX_GRID}.`;
  return null;
}
