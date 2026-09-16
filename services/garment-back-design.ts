"use server";

// Design Studio — Garment Back Design. Admin-only, same as Repeat Print
// Maker, AI Garment Studio and Print → Embroidery. Every AI call goes
// through the one shared engine (lib/ai/openai-client.ts) — no second
// OpenAI integration.
//
// Two real, sequential AI steps per generation (mirrors Print → Embroidery's
// analyze-then-convert shape): a vision read of the uploaded front image,
// then an image-conditioned edit that renders the back view. The analysis
// text is injected into the generation prompt as explicit "garment identity
// to preserve" grounding — not just UI-default plumbing — since there is no
// mask here to constrain drift, so the model needs strong textual anchoring
// in addition to the reference image.

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { runVisionChatCompletion, editImage, AIConfigError } from "@/lib/ai/openai-client";
import { validateImage } from "@/lib/file-validation";

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

async function requireAdmin() {
  const user = await getUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

function withAiErrorHandling<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  return fn()
    .then((data) => ({ success: true as const, data }))
    .catch((err) => ({
      success: false as const,
      error: err instanceof AIConfigError ? err.message : err instanceof Error ? err.message : "AI request failed.",
    }));
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = Buffer.from(await blob.arrayBuffer());
  return `data:${blob.type || "image/png"};base64,${buf.toString("base64")}`;
}

/** Inverse of blobToDataUrl — needed for Regenerate, which re-sends the
 * front image already stored as a data URL (never re-uploaded by the
 * user), and for reopening a saved design. Node's global Blob (available
 * since Node 18) makes this safe to do server-side with no extra library. */
function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:(.+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid front image data.");
  const buf = Buffer.from(match[2], "base64");
  return new Blob([buf], { type: match[1] });
}

/** OpenAI's images.edit only accepts a few fixed sizes — requesting one
 * that doesn't match the source's own aspect ratio forces the model to
 * reflow/reinterpret the whole composition to fit, not just render a new
 * view of it. Picking the closest real match keeps the model grounded in
 * the source's actual framing. Same convention as services/garment-studio.ts
 * and services/embroidery.ts (each keeps its own copy — a plain helper
 * can't be exported and shared from a "use server" file). */
function nearestSupportedSize(width: number, height: number): "1024x1024" | "1024x1536" | "1536x1024" {
  const ratio = width / height;
  if (ratio > 1.15) return "1536x1024";
  if (ratio < 0.87) return "1024x1536";
  return "1024x1024";
}

const ANALYSIS_SYSTEM_PROMPT = `You are a fashion design assistant. Look at this front-view garment image and write a concise factual description covering: garment type, silhouette, collar style, sleeve style, cuffs, buttons/zippers/hardware, fabric/texture, color palette, and any print/pattern/embroidery visible. Plain text, no preamble, no markdown, under 60 words. This description will be used to keep a generated back view consistent with this exact garment.`;

/** Stage 1 — a real vision read of the uploaded front image, via the same
 * shared client Garment Studio's suggestGarmentPromptAction and Print →
 * Embroidery's analyzeArtworkAction already use. Drives the "Analyzing
 * front design…" loading state honestly (a real network call, not a timed
 * fake), and its output becomes explicit grounding text for Stage 2. */
export async function analyzeFrontDesignAction(frontImage: Blob): Promise<ActionResult<string>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const check = validateImage(frontImage.type, frontImage.size);
  if (!check.valid) return { success: false, error: check.error! };

  return withAiErrorHandling(async () => {
    const dataUrl = await blobToDataUrl(frontImage);
    const text = await runVisionChatCompletion({
      system: ANALYSIS_SYSTEM_PROMPT,
      user: "Describe this garment.",
      images: [dataUrl],
      maxTokens: 150,
    });
    return text.trim();
  });
}

const BACK_DESIGN_BASE_PROMPT = [
  "Generate a realistic back-view fashion image of the exact same garment shown in the provided front-view reference.",
  "Preserve the garment's identity, silhouette, proportions, fabric, color palette, texture, print, embroidery, construction details, collar, sleeves, cuffs, buttons, seams and overall design language.",
  "Do not redesign the garment. Do not change the garment type. Do not invent a different garment. Do not change the material or color palette.",
  "Rotate the garment/viewpoint naturally so the result represents the back of the same garment.",
  "Continue existing prints, embroidery or decorative elements logically onto the back only where appropriate.",
  "Maintain realistic garment construction and stitching.",
  "The result should look like a professional fashion product/design presentation showing the back view of the same garment, on a plain neutral background, not on a person.",
].join(" ");

function buildBackDesignPrompt(analysis: string, backDescription: string): string {
  return [
    BACK_DESIGN_BASE_PROMPT,
    `Garment identity to preserve: ${analysis}`,
    backDescription.trim()
      ? `Additional guidance from the designer for the back view: ${backDescription.trim()}. Still preserve the original garment identity described above — this guidance must not change the garment type, silhouette, fabric, or color palette.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export interface GarmentBackDesignVersionRecord {
  id: string;
  image: string;
  createdAt: string;
}

export interface GarmentBackDesignDetail {
  id: string;
  name: string;
  frontImage: string;
  backDescription: string | null;
  versions: GarmentBackDesignVersionRecord[];
}

/** Stage 2 (first generation) — creates the GarmentBackDesign and its first
 * version in one call, same shape as generateGarmentAction. The front image
 * is persisted exactly as uploaded (never the AI result) so Regenerate and
 * reopening always condition on the same untouched reference. */
export async function generateBackDesignAction(
  frontImage: Blob,
  analysis: string,
  backDescription: string,
  width: number,
  height: number
): Promise<ActionResult<{ id: string; image: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const check = validateImage(frontImage.type, frontImage.size);
  if (!check.valid) return { success: false, error: check.error! };

  return withAiErrorHandling(async () => {
    const resultImage = await editImage({
      image: frontImage,
      prompt: buildBackDesignPrompt(analysis, backDescription),
      size: nearestSupportedSize(width, height),
    });

    const frontDataUrl = await blobToDataUrl(frontImage);
    const design = await db.garmentBackDesign.create({
      data: {
        ownerId: admin.id,
        name: "Untitled Back Design",
        frontImage: frontDataUrl,
        backDescription: backDescription.trim() || null,
        versions: { create: [{ image: resultImage, order: 0 }] },
      },
      select: { id: true },
    });

    return { id: design.id, image: resultImage };
  });
}

/** Stage 2 (Regenerate) — reuses the already-stored front image (the user
 * never re-uploads), always appends a new version, never overwrites an
 * earlier one — same append-only history behavior as commitGarmentEditAction. */
export async function regenerateBackDesignAction(
  designId: string,
  analysis: string,
  backDescription: string,
  width: number,
  height: number
): Promise<ActionResult<{ image: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const design = await db.garmentBackDesign.findUnique({ where: { id: designId } });
  if (!design) return { success: false, error: "Design not found." };

  return withAiErrorHandling(async () => {
    const frontBlob = dataUrlToBlob(design.frontImage);
    const resultImage = await editImage({
      image: frontBlob,
      prompt: buildBackDesignPrompt(analysis, backDescription),
      size: nearestSupportedSize(width, height),
    });

    const count = await db.garmentBackDesignVersion.count({ where: { designId } });
    await db.garmentBackDesignVersion.create({ data: { designId, image: resultImage, order: count } });
    await db.garmentBackDesign.update({
      where: { id: designId },
      data: { backDescription: backDescription.trim() || null },
    });

    return { image: resultImage };
  });
}

export async function getBackDesignAction(id: string): Promise<ActionResult<GarmentBackDesignDetail>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const design = await db.garmentBackDesign.findUnique({
    where: { id },
    include: { versions: { orderBy: { order: "asc" } } },
  });
  if (!design) return { success: false, error: "Design not found." };

  return {
    success: true,
    data: {
      id: design.id,
      name: design.name,
      frontImage: design.frontImage,
      backDescription: design.backDescription,
      versions: design.versions.map((v) => ({ id: v.id, image: v.image, createdAt: v.createdAt.toISOString() })),
    },
  };
}
