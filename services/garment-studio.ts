"use server";

// Design Studio — AI Garment Studio. Admin-only. Every operation that
// touches AI is real image-conditioned editing through the one shared
// client (lib/ai/openai-client.ts editImage) — GENERATE conditions on the
// uploaded photo/sketch (+ optional material reference) with no mask;
// every EDIT operation (Change/Regenerate/Remove/Patterns/Prints-Logos/
// Colorize) sends a real mask so only the selected region is ever
// touched. No second OpenAI integration, no text-only regeneration.

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { editImage, runVisionChatCompletion, AIConfigError } from "@/lib/ai/openai-client";
import { validateImage } from "@/lib/file-validation";

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

async function requireAdmin() {
  const user = await getUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

/** Defense in depth: client-side validation is UX only, this is the real
 * boundary for every user-uploaded (not AI-generated) image blob. */
function checkUploadedImage(blob: Blob): { valid: boolean; error?: string } {
  return validateImage(blob.type, blob.size);
}

function withAiErrorHandling<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  return fn()
    .then((data) => ({ success: true as const, data }))
    .catch((err) => ({
      success: false as const,
      error: err instanceof AIConfigError ? err.message : err instanceof Error ? err.message : "AI request failed.",
    }));
}

export interface GarmentDesignSummary {
  id: string;
  name: string;
  image: string; // latest version's image
  isSaved: boolean;
  versionCount: number;
  ownerName: string;
  updatedAt: string;
}

export interface GarmentDesignVersionRecord {
  id: string;
  label: string;
  image: string;
  createdAt: string;
}

export interface GarmentDesignDetail {
  id: string;
  name: string;
  originalImage: string;
  prompt: string | null;
  materialReferenceImage: string | null;
  isSaved: boolean;
  versions: GarmentDesignVersionRecord[];
}

/** GENERATE — real image-conditioned generation (uploaded photo/sketch +
 * optional material reference, no mask), never a text-only description.
 * Creates the GarmentDesign and its first "Original" version in one call. */
export async function generateGarmentAction(sourceImage: Blob, prompt: string, materialReference?: Blob): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  if (!sourceImage) return { success: false, error: "Upload a garment photo or sketch first." };
  if (!prompt.trim()) return { success: false, error: "Describe what you want to generate." };

  const sourceCheck = checkUploadedImage(sourceImage);
  if (!sourceCheck.valid) return { success: false, error: sourceCheck.error! };
  if (materialReference) {
    const materialCheck = checkUploadedImage(materialReference);
    if (!materialCheck.valid) return { success: false, error: materialCheck.error! };
  }

  return withAiErrorHandling(async () => {
    const images = materialReference ? [sourceImage, materialReference] : [sourceImage];
    const referenceNote = materialReference ? " A second reference image shows the desired fabric/material/print — apply that material's texture and color to the garment." : "";
    const resultImage = await editImage({
      image: images,
      prompt: `${prompt}${referenceNote} Keep this a clean, realistic product/fashion photo of the garment.`,
      size: "1024x1024",
    });

    const materialDataUrl = materialReference ? await blobToDataUrl(materialReference) : null;

    const design = await db.garmentDesign.create({
      data: {
        ownerId: admin.id,
        name: "Untitled Garment",
        originalImage: resultImage,
        prompt,
        materialReferenceImage: materialDataUrl,
        versions: {
          create: [{ label: "Original", image: resultImage, order: 0 }],
        },
      },
      select: { id: true },
    });

    return { id: design.id };
  });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = Buffer.from(await blob.arrayBuffer());
  return `data:${blob.type || "image/png"};base64,${buf.toString("base64")}`;
}

/** Real vision read of the uploaded sketch/photo, offered as an editable
 * suggestion the user can accept or ignore — never auto-applied. */
export async function suggestGarmentPromptAction(sourceImage: Blob): Promise<ActionResult<string>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const check = checkUploadedImage(sourceImage);
  if (!check.valid) return { success: false, error: check.error! };

  return withAiErrorHandling(async () => {
    const dataUrl = await blobToDataUrl(sourceImage);
    const text = await runVisionChatCompletion({
      system:
        "You are a fashion design assistant. Look at this garment photo or sketch and write ONE short, concrete generation prompt describing it: garment type, silhouette, sleeve style, neckline, notable construction details. Plain text, no preamble, no quotes, under 25 words.",
      user: "Describe this garment as a short generation prompt.",
      images: [dataUrl],
      maxTokens: 80,
    });
    return text.trim();
  });
}

async function requireDesign(id: string) {
  return db.garmentDesign.findUnique({ where: { id } });
}

/** OpenAI's images.edit only accepts a few fixed sizes — requesting one
 * that doesn't match the source's own aspect ratio forces the model to
 * reflow/reinterpret the whole composition to fit, not just the masked
 * region. Picking the closest real match keeps the model grounded in the
 * source's actual framing instead of fighting a mismatched canvas. */
function nearestSupportedSize(width: number, height: number): "1024x1024" | "1024x1536" | "1536x1024" {
  const ratio = width / height;
  if (ratio > 1.15) return "1536x1024";
  if (ratio < 0.87) return "1024x1536";
  return "1024x1024";
}

/** Shared AI-call path for every EDIT tool — deliberately does NOT persist
 * anything. The model's raw response is an untrusted intermediate result:
 * it is never assumed to have left pixels outside the mask untouched, no
 * matter what the prompt requested. The caller (the editor page) must run
 * it through GarmentCanvas.compositeWithAiResult (lib/garment-canvas.ts
 * compositeMaskedEdit) — which deterministically rebuilds outside-mask
 * pixels from the original — before calling commitGarmentEditAction. */
async function runMaskedEdit(
  designId: string,
  images: Blob | Blob[],
  mask: Blob,
  prompt: string,
  label: string,
  width: number,
  height: number
): Promise<ActionResult<{ image: string; label: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const design = await requireDesign(designId);
  if (!design) return { success: false, error: "Design not found." };

  return withAiErrorHandling(async () => {
    const resultImage = await editImage({ image: images, mask, prompt, size: nearestSupportedSize(width, height) });
    return { image: resultImage, label };
  });
}

/** The ONLY place a GarmentDesignVersion is created for an edit tool —
 * shared by all six (Change/Regenerate/Remove/Patterns/Prints-Logos/
 * Colorize). Must be called with the already client-composited final
 * image (see runMaskedEdit's doc comment), never with a raw AI response —
 * this function has no way to tell the difference, so that guarantee is
 * enforced entirely by the editor page's call sequence. Never overwrites
 * earlier versions; always appends.
 *
 * `image` is a Blob, not a data URL string — a multi-megabyte base64
 * string passed as a plain Server Action argument hits a real Next.js/
 * React Flight serialization limit ("Maximum array nesting exceeded",
 * confirmed by testing this exact action). Converted to the data URL the
 * DB column stores via the same blobToDataUrl used by generateGarmentAction. */
export async function commitGarmentEditAction(designId: string, image: Blob, label: string): Promise<ActionResult<{ versionId: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const design = await requireDesign(designId);
  if (!design) return { success: false, error: "Design not found." };

  const imageDataUrl = await blobToDataUrl(image);
  const count = await db.garmentDesignVersion.count({ where: { designId } });
  const version = await db.garmentDesignVersion.create({
    data: { designId, label, image: imageDataUrl, order: count },
    select: { id: true },
  });
  await db.garmentDesign.update({ where: { id: designId }, data: { updatedAt: new Date() } });

  return { success: true, data: { versionId: version.id } };
}

const PRESERVE_INSTRUCTION =
  "Modify only the masked region. Preserve everything outside the mask exactly: the model/person, pose, face, other garment parts, background, lighting, and composition. Maintain realistic fabric folds, shadows, and continuity at the edges of the edit.";

export async function changeRegionAction(designId: string, currentImage: Blob, mask: Blob, instruction: string, width: number, height: number): Promise<ActionResult<{ image: string; label: string }>> {
  if (!instruction.trim()) return { success: false, error: "Describe the change you want." };
  return runMaskedEdit(designId, currentImage, mask, `${instruction} ${PRESERVE_INSTRUCTION}`, "Change", width, height);
}

export async function regenerateRegionAction(designId: string, currentImage: Blob, mask: Blob, instruction: string | undefined, width: number, height: number): Promise<ActionResult<{ image: string; label: string }>> {
  const prompt = instruction?.trim()
    ? `Generate a fresh alternative for the masked region: ${instruction}. ${PRESERVE_INSTRUCTION}`
    : `Generate a fresh alternative interpretation of the masked region, consistent with the rest of the garment's style. ${PRESERVE_INSTRUCTION}`;
  return runMaskedEdit(designId, currentImage, mask, prompt, "Regenerate", width, height);
}

export async function removeRegionAction(designId: string, currentImage: Blob, mask: Blob, width: number, height: number): Promise<ActionResult<{ image: string; label: string }>> {
  const prompt = `Remove the masked detail entirely and naturally reconstruct the underlying fabric/garment surface as if it was never there. ${PRESERVE_INSTRUCTION}`;
  return runMaskedEdit(designId, currentImage, mask, prompt, "Remove", width, height);
}

export async function applyPatternAction(
  designId: string,
  currentImage: Blob,
  mask: Blob,
  patternImage: Blob,
  scalePercent: number,
  rotationDeg: number,
  brightnessPercent: number,
  width: number,
  height: number
): Promise<ActionResult<{ image: string; label: string }>> {
  const check = checkUploadedImage(patternImage);
  if (!check.valid) return { success: false, error: check.error! };
  const prompt = `Apply the pattern shown in the second reference image to the masked region only, tiled at approximately ${Math.round(scalePercent)}% relative scale, rotated ${Math.round(rotationDeg)} degrees, at ${Math.round(brightnessPercent)}% brightness. The pattern must follow the garment's real fabric folds, shadows, and highlights — it must not look like a flat rectangle pasted on top. ${PRESERVE_INSTRUCTION}`;
  return runMaskedEdit(designId, [currentImage, patternImage], mask, prompt, "Apply pattern", width, height);
}

export async function applyPrintLogoAction(
  designId: string,
  currentImage: Blob,
  mask: Blob,
  logoImage: Blob,
  scalePercent: number,
  rotationDeg: number,
  brightnessPercent: number,
  width: number,
  height: number
): Promise<ActionResult<{ image: string; label: string }>> {
  const check = checkUploadedImage(logoImage);
  if (!check.valid) return { success: false, error: check.error! };
  const prompt = `Apply the print/logo shown in the second reference image onto the masked region only, at approximately ${Math.round(scalePercent)}% relative scale, rotated ${Math.round(rotationDeg)} degrees, at ${Math.round(brightnessPercent)}% brightness. Integrate it realistically into the garment's fabric — follow its folds, shadows and perspective, don't leave it as a flat overlay. ${PRESERVE_INSTRUCTION}`;
  return runMaskedEdit(designId, [currentImage, logoImage], mask, prompt, "Apply print/logo", width, height);
}

export async function colorizeRegionAction(
  designId: string,
  currentImage: Blob,
  mask: Blob,
  colorHex: string,
  brightnessPercent: number,
  width: number,
  height: number
): Promise<ActionResult<{ image: string; label: string }>> {
  const prompt = `Recolor the masked region to ${colorHex} at approximately ${Math.round(brightnessPercent)}% brightness. Preserve the fabric's texture, folds, shadows and highlights — do not flat-fill the region, keep it looking like real dyed fabric. ${PRESERVE_INSTRUCTION}`;
  return runMaskedEdit(designId, currentImage, mask, prompt, "Colorize", width, height);
}

export async function getGarmentDesignsAction(filter: "all" | "saved" | "edited"): Promise<ActionResult<GarmentDesignSummary[]>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const rows = await db.garmentDesign.findMany({
    orderBy: { updatedAt: "desc" },
    take: 48,
    include: { owner: { select: { name: true } }, versions: { orderBy: { order: "desc" }, take: 1 }, _count: { select: { versions: true } } },
  });

  const filtered = rows.filter((r) => {
    if (filter === "saved") return r.isSaved;
    if (filter === "edited") return r._count.versions > 1;
    return true;
  });

  return {
    success: true,
    data: filtered.map((r) => ({
      id: r.id,
      name: r.name,
      image: r.versions[0]?.image ?? r.originalImage,
      isSaved: r.isSaved,
      versionCount: r._count.versions,
      ownerName: r.owner.name,
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}

export async function getGarmentDesignAction(id: string): Promise<ActionResult<GarmentDesignDetail>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const design = await db.garmentDesign.findUnique({
    where: { id },
    include: { versions: { orderBy: { order: "asc" } } },
  });
  if (!design) return { success: false, error: "Design not found." };

  return {
    success: true,
    data: {
      id: design.id,
      name: design.name,
      originalImage: design.originalImage,
      prompt: design.prompt,
      materialReferenceImage: design.materialReferenceImage,
      isSaved: design.isSaved,
      versions: design.versions.map((v) => ({ id: v.id, label: v.label, image: v.image, createdAt: v.createdAt.toISOString() })),
    },
  };
}

export async function toggleSaveGarmentDesignAction(id: string): Promise<ActionResult<{ isSaved: boolean }>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const design = await db.garmentDesign.findUnique({ where: { id }, select: { isSaved: true } });
  if (!design) return { success: false, error: "Design not found." };

  const updated = await db.garmentDesign.update({ where: { id }, data: { isSaved: !design.isSaved }, select: { isSaved: true } });
  return { success: true, data: updated };
}

export async function renameGarmentDesignAction(id: string, name: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  if (!name.trim()) return { success: false, error: "Name can't be empty." };

  const design = await db.garmentDesign.findUnique({ where: { id }, select: { id: true } });
  if (!design) return { success: false, error: "Design not found." };

  await db.garmentDesign.update({ where: { id }, data: { name: name.trim() } });
  return { success: true, data: undefined };
}

export async function deleteGarmentDesignAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const design = await db.garmentDesign.findUnique({ where: { id }, select: { id: true } });
  if (!design) return { success: false, error: "Design not found." };

  await db.garmentDesign.delete({ where: { id } });
  return { success: true, data: undefined };
}
