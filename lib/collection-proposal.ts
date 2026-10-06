// Collection Proposal — the board's rules, the prompts and the plan check.
// Pure (no "use server", no DB, no network), so the page, the server
// actions and the tests share exactly the same rules.

/** How many bestseller photos can be uploaded for one proposal. */
export const COLLECTION_MAX_IMAGES = 9;
export const COLLECTION_MIN_COUNT = 1;
export const COLLECTION_MAX_COUNT = 9;
export const COLLECTION_DEFAULT_COUNT = 4;

/** Longest side, in pixels, an upload is reduced to in the browser before it is sent. */
export const COLLECTION_UPLOAD_MAX_PX = 1536;

/** Every look is a full-length outfit, so each image is portrait. */
export const LOOK_IMAGE_SIZE = "1024x1536" as const;
export const CORE_DNA_COUNT = 6;
export const LOOK_DETAIL_COUNT = 3;

/** A type alias (not an interface) so a list of looks can be stored as JSON. */
export type CollectionLook = {
  title: string;
  /** Exactly LOOK_DETAIL_COUNT short design-detail bullets, shown on the board. */
  details: string[];
  /** What the look image shows: the complete outfit, for the image step. */
  description: string;
};

export interface CollectionPlan {
  /** One short description of the model, so every look is shot on the same person. */
  model: string;
  /** Exactly CORE_DNA_COUNT keywords: mood, signature fabric/print, colour pair, silhouette, details, quality. */
  coreDNA: string[];
  looks: CollectionLook[];
}

export const clampCollectionCount = (n: number) =>
  Math.min(COLLECTION_MAX_COUNT, Math.max(COLLECTION_MIN_COUNT, Math.round(Number.isFinite(n) ? n : COLLECTION_DEFAULT_COUNT)));

export const COLLECTION_PLAN_SYSTEM_PROMPT = [
  "You are a senior fashion designer building a collection proposal around a bestselling style.",
  "The photo(s) all show the SAME bestselling item. Read its design language, then propose a cohesive collection of complete looks that keep that language.",
  "Each look is a full outfit that may mix categories (tops, bottoms, dresses, outerwear, accessories), all worn by one model.",
  "Reply with ONLY a JSON object, no preamble, in exactly this shape:",
  '{"model": string, "coreDNA": [6 strings], "looks": [{"title": string, "details": [3 strings], "description": string}]}.',
  "model: one sentence describing the one model (apparent age range, hair, build, skin tone) who wears every look.",
  "coreDNA: exactly six 1–3 word keywords covering, in order: mood; signature fabric or print; colour pair; silhouette; signature details; quality level.",
  "title: 2–4 words naming the look. details: exactly three short bullets, each under 12 words, naming garments, fabrics, colours or details the designer would note.",
  "description: 1–2 sentences describing the complete outfit in plain visual terms for an image generator (garments, fabrics, colours, fit). No brand names, no text, no measurements.",
  "Keep every look recognisably part of the bestseller's family, and make each look different from the others.",
].join(" ");

/** The user line for the plan step: how many looks are wanted. */
export function buildCollectionPlanUserPrompt(count: number, imageCount: number): string {
  const n = clampCollectionCount(count);
  return `${imageCount > 1 ? `These ${imageCount} photos show` : "This photo shows"} the bestseller. Propose a collection of exactly ${n} look${n === 1 ? "" : "s"}, and the Core DNA. Reply with the JSON object only.`;
}

/**
 * Checks a plan the model (or the client) sent back and returns a clean copy.
 * Throws with a message for the user if the plan is unusable, so a bad
 * model reply never reaches the image step or the board.
 */
export function parseCollectionPlan(raw: unknown, count: number): CollectionPlan {
  const n = clampCollectionCount(count);
  const fail = (): never => {
    throw new Error("The AI's collection plan was incomplete. Please generate again.");
  };
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      fail();
    }
  }
  if (!raw || typeof raw !== "object") fail();
  const p = raw as Record<string, unknown>;

  const model = typeof p.model === "string" ? p.model.trim() : "";
  if (!model) fail();

  const coreDNA = Array.isArray(p.coreDNA) ? p.coreDNA.filter((k): k is string => typeof k === "string" && k.trim() !== "").map((k) => k.trim()) : [];
  if (coreDNA.length < CORE_DNA_COUNT) fail();

  const looksIn = Array.isArray(p.looks) ? p.looks : [];
  if (looksIn.length !== n) fail();
  const looks = looksIn.map((item): CollectionLook => {
    if (!item || typeof item !== "object") return fail();
    const l = item as Record<string, unknown>;
    const title = typeof l.title === "string" ? l.title.trim() : "";
    const description = typeof l.description === "string" ? l.description.trim() : "";
    const details = Array.isArray(l.details) ? l.details.filter((d): d is string => typeof d === "string" && d.trim() !== "").map((d) => d.trim()) : [];
    if (!title || !description || details.length < LOOK_DETAIL_COUNT) fail();
    return { title, details: details.slice(0, LOOK_DETAIL_COUNT), description };
  });

  return { model, coreDNA: coreDNA.slice(0, CORE_DNA_COUNT), looks };
}

/** The image prompt for one look: the outfit, the same model, and the Core DNA as the collection's shared identity. */
export function buildLookPrompt(input: { look: CollectionLook; plan: Pick<CollectionPlan, "model" | "coreDNA">; imageCount: number }): string {
  return [
    `The attached ${input.imageCount > 1 ? `${input.imageCount} photos show` : "photo shows"} one bestselling fashion item. It is the design reference for a fashion collection.`,
    `Create ONE complete outfit look for that collection: ${input.look.description}`,
    `The look must keep the bestseller's design language and the collection's core identity: ${input.plan.coreDNA.join(", ")}.`,
    `Show it worn by the same model in every look: ${input.plan.model}`,
    "Full length, standing, facing the camera, on a plain light studio background, with consistent lighting and framing.",
    "Photorealistic, professional fashion lookbook quality, sharp garment details, accurate fabric rendering.",
    "No text, no numbers, no labels, no captions, no logos, no watermarks, no borders.",
  ].join(" ");
}

/** Checks a generation request; returns a message for the user if something is wrong. */
export function validateCollectionRequest(input: { imageCount: number; count: unknown }): string | null {
  if (!(input.imageCount >= 1)) return "Upload at least one bestseller image.";
  if (input.imageCount > COLLECTION_MAX_IMAGES) return `Upload at most ${COLLECTION_MAX_IMAGES} images.`;
  const c = Number(input.count);
  if (!Number.isInteger(c) || c < COLLECTION_MIN_COUNT || c > COLLECTION_MAX_COUNT) return `Collection count must be between ${COLLECTION_MIN_COUNT} and ${COLLECTION_MAX_COUNT}.`;
  return null;
}
