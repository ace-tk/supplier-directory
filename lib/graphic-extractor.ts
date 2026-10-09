// Graphic Extractor — detect and extract the complete graphic / pattern from a
// product or reference image. Pure (no "use server", no DB, no network) so the
// page, the server actions and the tests share one set of rules.

import { IMAGE_MAX_COUNT, IMAGE_MIN_COUNT, IMAGE_MODES, IMAGE_SIZES, IMAGE_UPLOAD_MAX_PX, clampImageCount, imageQuality, isImageMode, isImageSize, sizeForAspect, type ImageMode, type ImageSize } from "@/lib/image-to-design";

// Same generation modes, sizes and 1-4 image count as Image to Design.
export {
  IMAGE_MAX_COUNT as EXTRACT_MAX_COUNT,
  IMAGE_MIN_COUNT as EXTRACT_MIN_COUNT,
  IMAGE_MODES as EXTRACT_MODES,
  IMAGE_SIZES as EXTRACT_SIZES,
  IMAGE_UPLOAD_MAX_PX as EXTRACT_UPLOAD_MAX_PX,
  clampImageCount as clampExtractCount,
  imageQuality as extractQuality,
  isImageMode as isExtractMode,
  isImageSize as isExtractSize,
  sizeForAspect as extractSizeForAspect,
};
export type { ImageMode as ExtractMode, ImageSize as ExtractSize };

/** Shown by the two switches (Style3D's own wording for what each does). */
export const REMOVE_CRAFT_HELP = [
  "Off: extract the pattern while preserving all original pattern elements — points, lines, shapes, colors, composition and theme.",
  "On: extract the pattern as a flat pattern without changing its details. Craft effects and fabric texture are removed, along with anything outside the pattern.",
];
export const TRANSPARENT_HELP = "Turns on automatic background removal after the pattern is extracted, so you get a PNG with a transparent background.";

export const EXTRACT_DETECT_SYSTEM_PROMPT = [
  "You are a print and graphic designer looking at a photo of a garment or product to find the graphic or pattern printed, woven or embroidered on it.",
  'Reply with JSON only, in this exact shape: {"found": boolean, "kind": string, "description": string, "hasCraft": boolean, "reason": string}.',
  '"found": true only if there is a real graphic, motif, logo, illustration or repeating pattern to extract (a plain, undecorated garment is false).',
  '"kind": one of "all-over print", "placement graphic", "embroidery", "woven or knit pattern", "logo or lettering", "other".',
  '"description": under 80 words — the motifs, their colours, line work, layout and composition, and how the pattern repeats or is placed. Empty if found is false.',
  '"hasCraft": true if craft effects such as embroidery stitches, appliqué, beading, sequins, foil, flocking or raised/3D texture are visible on it, or fabric texture shows through it.',
  '"reason": if found is false, one short sentence on why; otherwise an empty string.',
  "No other keys, no commentary.",
].join(" ");

export interface GraphicDetection {
  found: boolean;
  kind: string;
  description: string;
  hasCraft: boolean;
  reason: string;
}

/** Reads the AI's JSON answer defensively; throws a message fit to show the user if it is unusable. */
export function parseGraphicDetection(text: string): GraphicDetection {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("The AI's answer couldn't be read. Please try again.");
  }
  const o = (data ?? {}) as Record<string, unknown>;
  const found = o.found === true;
  const description = typeof o.description === "string" ? o.description.trim() : "";
  if (found && !description) throw new Error("The AI didn't describe the graphic. Please try again.");
  return {
    found,
    kind: typeof o.kind === "string" ? o.kind.trim() : "other",
    description,
    hasCraft: o.hasCraft === true,
    reason: typeof o.reason === "string" ? o.reason.trim() : "",
  };
}

/** What to tell the user when nothing was found. */
export const NO_GRAPHIC_MESSAGE = "No graphic or pattern was found in this image. Try a photo where the print is clearly visible and fills more of the frame.";

export interface ExtractPromptInput {
  removeCraft: boolean;
  transparent: boolean;
  /** The AI's read of the graphic (from EXTRACT_DETECT_SYSTEM_PROMPT). */
  description: string;
  kind?: string;
}

/** The generation prompt for ONE extraction. The photo carries the real pixels; the read names what must be reproduced. */
export function buildExtractPrompt(input: ExtractPromptInput): string {
  const lines = [
    "The attached photo shows a garment or product that carries a graphic or pattern. Extract that graphic as a clean, flat, front-facing design asset.",
    `What it shows${input.kind ? ` (${input.kind})` : ""}: ${input.description.trim()}`,
    "Detect the COMPLETE pattern and show all of it, fully inside the frame, centred, straight on. If the garment carries several separate graphics, extract the most prominent complete one.",
    "Remove the garment, the model, hangers, folds, wrinkles, shadows, lighting and perspective: only the pattern itself remains, undistorted, as if it had been printed flat.",
  ];
  if (input.removeCraft) {
    lines.push(
      "Generate a flat pattern without changing the pattern details. Remove the craft effects (embroidery stitches, appliqué, beading, sequins, foil, raised or 3D texture) and the fabric texture, so it looks like clean flat printed art, and remove any content outside the pattern."
    );
  } else {
    lines.push("Preserve ALL original pattern elements exactly — points, lines, shapes, colors, composition and theme. Do not simplify, restyle, recolour or add anything.");
  }
  lines.push(
    input.transparent
      ? "Place the pattern on a plain, pure white background with nothing else in the frame and no shadow, so the background can be removed cleanly afterwards."
      : "Place the pattern on a plain white background with nothing else in the frame.",
    "No text unless it is part of the original pattern, no labels, no captions, no watermarks, no borders, no frame."
  );
  return lines.join(" ");
}

/** Checks what an extraction is asked for; returns a message for the user if something is wrong. */
export function validateExtractRequest(input: { imageCount: number; removeCraft: unknown; transparent: unknown; mode: unknown; size: unknown; count: unknown }): string | null {
  if (!(input.imageCount >= 1)) return "Upload a style image.";
  if (input.imageCount > 1) return "Upload one style image at a time.";
  if (typeof input.removeCraft !== "boolean" || typeof input.transparent !== "boolean") return "Choose the extraction options.";
  if (!isImageMode(input.mode)) return "Choose a generation mode.";
  if (!isImageSize(input.size)) return "Choose an image size.";
  const c = Number(input.count);
  if (!Number.isInteger(c) || c < IMAGE_MIN_COUNT || c > IMAGE_MAX_COUNT) return `You can make ${IMAGE_MIN_COUNT} to ${IMAGE_MAX_COUNT} images at a time.`;
  return null;
}
