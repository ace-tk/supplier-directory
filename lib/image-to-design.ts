// Image to Design — create new style options from an existing garment image.
// Pure (no "use server", no DB, no network) so the page, the server actions
// and the tests share one set of rules.
//
// Four redesign directions, as in Style3D:
//   Type    — turn the garment into another category (target category)
//   Style   — redesign it in a new fashion style (target style)
//   Shape   — keep the silhouette / chosen block elements, redesign the rest
//   Custom  — apply one free-text adjustment ("change the chest print to a puppy")

export type ImageDirection = "category" | "style" | "shape" | "custom";

export const IMAGE_DIRECTIONS: {
  id: ImageDirection;
  label: string;
  descriptionLabel: string;
  placeholder: string;
  /** The picker beside the description, if the direction has one. */
  pickerLabel: string | null;
  /** The description alone is enough to generate. */
  descriptionAlone: boolean;
}[] = [
  { id: "category", label: "Type", descriptionLabel: "Category Description", placeholder: "e.g. niche designer shirt dress...", pickerLabel: "Target Category", descriptionAlone: false },
  { id: "style", label: "Style", descriptionLabel: "Style Description", placeholder: "e.g. bohemian resort style...", pickerLabel: "Target Style", descriptionAlone: true },
  {
    id: "shape",
    label: "Shape",
    descriptionLabel: "Silhouette Description",
    placeholder: "Enter a style description to generate the corresponding style (including category, style, material, design details, etc.), e.g., a V-neck, white, mid-length, single-breasted, linen dress.",
    pickerLabel: "Common Block Elements",
    descriptionAlone: true,
  },
  { id: "custom", label: "Custom", descriptionLabel: "Style Description", placeholder: "Describe the style adjustment direction, e.g. change the chest print to a puppy", pickerLabel: null, descriptionAlone: true },
];

export const isImageDirection = (v: unknown): v is ImageDirection => IMAGE_DIRECTIONS.some((d) => d.id === v);

/** The garment categories a photo can be turned into, grouped as in Style3D's "Target Category" picker. */
export const TARGET_CATEGORY_GROUPS: { group: string; items: string[] }[] = [
  { group: "Tops", items: ["T-shirts", "Shirts", "Sweatshirts", "Knitwear", "Suits", "Down Jackets", "Trench Coats", "Jackets", "Leather Jackets"] },
  { group: "Bottoms", items: ["Straight-leg Pants", "Skirts", "Wide-leg Pants", "Jeans", "Capri Pants", "Shorts", "Pleated Skirts"] },
  { group: "One-piece", items: ["Dresses", "Jumpsuits", "Slip Dresses"] },
  { group: "Sets", items: ["Suit Sets", "Sportswear Sets", "Casual Sets"] },
];
export const TARGET_CATEGORIES: string[] = TARGET_CATEGORY_GROUPS.flatMap((g) => g.items);
export const isTargetCategory = (v: unknown): v is string => typeof v === "string" && TARGET_CATEGORIES.includes(v);

/** The optional "Style Category" picker (what the uploaded garment is). */
export const IMAGE_STYLE_CATEGORIES = ["Tops", "Bottoms", "Dresses", "Sets", "Outerwear", "Innerwear", "Hats", "Shoes", "Bags"] as const;
export const isImageStyleCategory = (v: unknown): v is (typeof IMAGE_STYLE_CATEGORIES)[number] => typeof v === "string" && (IMAGE_STYLE_CATEGORIES as readonly string[]).includes(v);

export type ImageMode = "standard" | "professional";
export const IMAGE_MODES: { id: ImageMode; label: string; hint: string; quality: "medium" | "high" }[] = [
  { id: "standard", label: "Standard", hint: "Fast, good-quality results.", quality: "medium" },
  { id: "professional", label: "Professional", hint: "Highest detail and fabric accuracy. Slower.", quality: "high" },
];
export const isImageMode = (v: unknown): v is ImageMode => v === "standard" || v === "professional";
export const imageQuality = (m: ImageMode) => IMAGE_MODES.find((x) => x.id === m)!.quality;

/** The three image sizes the AI supports. */
export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";
export const IMAGE_SIZES: { id: "original" | "square" | "portrait" | "landscape"; label: string; size: ImageSize | null }[] = [
  { id: "original", label: "Original", size: null },
  { id: "square", label: "Square", size: "1024x1024" },
  { id: "portrait", label: "Portrait", size: "1024x1536" },
  { id: "landscape", label: "Landscape", size: "1536x1024" },
];
export const isImageSize = (v: unknown): v is ImageSize => v === "1024x1024" || v === "1024x1536" || v === "1536x1024";

/** "Original" keeps the shape of the upload: the supported size whose shape is closest to it. */
export function sizeForAspect(width: number, height: number): ImageSize {
  if (!(width > 0) || !(height > 0)) return "1024x1024";
  const r = width / height;
  if (r >= 1.2) return "1536x1024";
  if (r <= 0.83) return "1024x1536";
  return "1024x1024";
}

/** How many images one generation makes (Style3D: up to four to compare directions). */
export const IMAGE_MIN_COUNT = 1;
export const IMAGE_MAX_COUNT = 4;
export const clampImageCount = (n: number) => Math.min(IMAGE_MAX_COUNT, Math.max(IMAGE_MIN_COUNT, Math.round(Number.isFinite(n) ? n : 1)));

/** Longest side, in pixels, an upload is reduced to in the browser before it is sent. */
export const IMAGE_UPLOAD_MAX_PX = 1536;
export const IMAGE_DESCRIPTION_MAX_CHARS = 500;
export const IMAGE_MAX_BLOCKS = 8;

/** One call: reads the garment and proposes the choices the "Target Style" and "Common Block Elements" pickers offer. */
export const IMAGE_READ_SYSTEM_PROMPT = [
  "You are a senior fashion designer looking at a photo of ONE garment that will be redesigned.",
  'Reply with JSON only, in this exact shape: {"analysis": string, "styles": string[], "blocks": string[]}.',
  '"analysis": a factual description in under 90 words — what the garment is, its silhouette, length and fit, colour palette, fabric and texture, print or pattern, and signature details.',
  '"styles": exactly 8 short fashion style directions (2-3 words each, such as "Bohemian resort", "Minimal tailoring", "Retro sportswear") that would make interesting redesigns of THIS garment.',
  '"blocks": 6 to 8 structural elements of THIS garment that define its silhouette and could be kept while the rest is redesigned (such as "V-neckline", "Puff sleeves", "A-line skirt", "Cropped length"), each 1-3 words.',
  "No other keys, no commentary.",
].join(" ");

export interface ImageRead {
  analysis: string;
  styles: string[];
  blocks: string[];
}

const cleanList = (v: unknown, max: number): string[] => {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") continue;
    const s = item.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
};

/** Reads the AI's JSON answer defensively; throws a message fit to show the user if there is no usable analysis. */
export function parseImageRead(text: string): ImageRead {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("The AI's answer couldn't be read. Please try again.");
  }
  const o = (data ?? {}) as Record<string, unknown>;
  const analysis = typeof o.analysis === "string" ? o.analysis.trim() : "";
  if (!analysis) throw new Error("The AI didn't describe the garment. Please try again.");
  return { analysis, styles: cleanList(o.styles, 8), blocks: cleanList(o.blocks, 8) };
}

export interface ImagePromptInput {
  direction: ImageDirection;
  /** Target category (direction "category") or target style (direction "style"). */
  target?: string;
  /** Block elements to keep (direction "shape"). */
  blocks?: string[];
  description?: string;
  /** Optional: what the uploaded garment is. */
  styleCategory?: string;
  /** The AI's read of the garment (from IMAGE_READ_SYSTEM_PROMPT). */
  analysis: string;
  /** 1-based position of this image and how many are made, so each explores a different take. */
  index: number;
  total: number;
}

/** The generation prompt for ONE image. The photo carries the real pixels; the read names what to preserve. */
export function buildImageDesignPrompt(input: ImagePromptInput): string {
  const description = (input.description ?? "").trim();
  const blocks = (input.blocks ?? []).filter(Boolean);
  const lines: string[] = [
    `The attached photo shows one garment${input.styleCategory ? ` (category: ${input.styleCategory})` : ""} that is the starting point for a redesign.`,
    `About it: ${input.analysis.trim()}`,
  ];

  switch (input.direction) {
    case "category":
      lines.push(
        `Redesign it as a ${input.target ?? "garment"}: a ${input.target ?? "garment"} in the same fabric, colour palette, print, mood and signature details as the original, so it clearly belongs to the same family of styles.`,
        description ? `Design notes: ${description}.` : "Choose the cut, length and details that suit a " + (input.target ?? "garment") + " made in this fabric."
      );
      break;
    case "style":
      lines.push(
        `Redesign it in this fashion style: ${[input.target, description].filter(Boolean).join(" — ")}.`,
        "Change the silhouette, proportions, details, trims and mood to express that style, while keeping it recognisably the same type of garment and drawing on the original's fabric and colour story where it suits the style."
      );
      break;
    case "shape":
      lines.push(
        blocks.length
          ? `Keep these structural elements of the original exactly as they are, as the fixed block of the design: ${blocks.join(", ")}.`
          : "Keep the overall silhouette and proportions of the original as the fixed block of the design.",
        description ? `Redesign everything else to match this description: ${description}.` : "Redesign everything else (fabric, colour, print and surface details) in a fresh but coherent direction."
      );
      break;
    case "custom":
      lines.push(`Make exactly this change to the garment: ${description}.`, "Change only what that asks for. Keep everything else — silhouette, fabric, colour, proportions, every other detail — exactly as in the photo.");
      break;
  }

  if (input.direction !== "custom" && input.styleCategory && input.direction !== "category") {
    lines.push(`The result must remain a ${input.styleCategory.toLowerCase()} garment.`);
  }
  if (input.total > 1) {
    lines.push(`This is design ${input.index} of ${input.total} from the same brief: make it a clearly different interpretation from the other ${input.total - 1}, not a copy.`);
  }
  lines.push(
    "Show the finished garment as a clean fashion product image: the same kind of presentation as the photo (worn on a model if the photo shows a model, otherwise laid flat or on a ghost mannequin), straight on, centred, fully inside the frame, on a plain light neutral background.",
    "No text, no numbers, no labels, no captions, no logos, no watermarks, no borders.",
    "Photorealistic, professional fashion design quality, sharp garment details, accurate fabric rendering."
  );
  return lines.join(" ");
}

/** Checks what a generation is asked for; returns a message for the user if something is wrong. */
export function validateImageDesignRequest(input: {
  imageCount: number;
  direction: unknown;
  target?: unknown;
  blocks?: unknown;
  description?: unknown;
  styleCategory?: unknown;
  mode: unknown;
  size: unknown;
  count: unknown;
}): string | null {
  if (!(input.imageCount >= 1)) return "Upload a style image.";
  if (input.imageCount > 1) return "Upload one style image at a time.";
  if (!isImageDirection(input.direction)) return "Choose a redesign direction.";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (description.length > IMAGE_DESCRIPTION_MAX_CHARS) return `The description must be at most ${IMAGE_DESCRIPTION_MAX_CHARS} characters.`;
  if (input.styleCategory !== undefined && input.styleCategory !== "" && !isImageStyleCategory(input.styleCategory)) return "Choose a valid style category.";
  const target = typeof input.target === "string" ? input.target.trim() : "";
  const blocks = Array.isArray(input.blocks) ? input.blocks.filter((b): b is string => typeof b === "string" && b.trim() !== "") : [];
  if (blocks.length > IMAGE_MAX_BLOCKS) return `Choose at most ${IMAGE_MAX_BLOCKS} block elements.`;
  switch (input.direction) {
    case "category":
      if (!isTargetCategory(target)) return "Choose a target category.";
      break;
    case "style":
      if (!target && !description) return "Choose a target style or describe the style.";
      break;
    case "shape":
      if (!blocks.length && !description) return "Choose block elements to keep or describe the silhouette.";
      break;
    case "custom":
      if (!description) return "Describe the change you want.";
      break;
  }
  if (!isImageMode(input.mode)) return "Choose a generation mode.";
  if (!isImageSize(input.size)) return "Choose an image size.";
  const c = Number(input.count);
  if (!Number.isInteger(c) || c < IMAGE_MIN_COUNT || c > IMAGE_MAX_COUNT) return `You can make ${IMAGE_MIN_COUNT} to ${IMAGE_MAX_COUNT} images at a time.`;
  return null;
}
