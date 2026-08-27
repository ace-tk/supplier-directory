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

/** Shared commit path for every EDIT tool: real masked images.edit call,
 * then one real GarmentDesignVersion appended — never overwrites earlier
 * versions, never regenerates outside the mask. */
async function applyEditAndPersist(
  designId: string,
  images: Blob | Blob[],
  mask: Blob,
  prompt: string,
  label: string
): Promise<ActionResult<{ versionId: string; image: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const design = await requireDesign(designId);
  if (!design) return { success: false, error: "Design not found." };

  return withAiErrorHandling(async () => {
    const resultImage = await editImage({ image: images, mask, prompt, size: "1024x1024" });

    const count = await db.garmentDesignVersion.count({ where: { designId } });
    const version = await db.garmentDesignVersion.create({
      data: { designId, label, image: resultImage, order: count },
      select: { id: true },
    });
    await db.garmentDesign.update({ where: { id: designId }, data: { updatedAt: new Date() } });

    return { versionId: version.id, image: resultImage };
  });
}

const PRESERVE_INSTRUCTION =
  "Modify only the masked region. Preserve everything outside the mask exactly: the model/person, pose, face, other garment parts, background, lighting, and composition. Maintain realistic fabric folds, shadows, and continuity at the edges of the edit.";

export async function changeRegionAction(designId: string, currentImage: Blob, mask: Blob, instruction: string): Promise<ActionResult<{ versionId: string; image: string }>> {
  if (!instruction.trim()) return { success: false, error: "Describe the change you want." };
  return applyEditAndPersist(designId, currentImage, mask, `${instruction} ${PRESERVE_INSTRUCTION}`, "Change");
}

export async function regenerateRegionAction(designId: string, currentImage: Blob, mask: Blob, instruction?: string): Promise<ActionResult<{ versionId: string; image: string }>> {
  const prompt = instruction?.trim()
    ? `Generate a fresh alternative for the masked region: ${instruction}. ${PRESERVE_INSTRUCTION}`
    : `Generate a fresh alternative interpretation of the masked region, consistent with the rest of the garment's style. ${PRESERVE_INSTRUCTION}`;
  return applyEditAndPersist(designId, currentImage, mask, prompt, "Regenerate");
}

export async function removeRegionAction(designId: string, currentImage: Blob, mask: Blob): Promise<ActionResult<{ versionId: string; image: string }>> {
  const prompt = `Remove the masked detail entirely and naturally reconstruct the underlying fabric/garment surface as if it was never there. ${PRESERVE_INSTRUCTION}`;
  return applyEditAndPersist(designId, currentImage, mask, prompt, "Remove");
}

export async function applyPatternAction(
  designId: string,
  currentImage: Blob,
  mask: Blob,
  patternImage: Blob,
  scalePercent: number,
  rotationDeg: number,
  brightnessPercent: number
): Promise<ActionResult<{ versionId: string; image: string }>> {
  const check = checkUploadedImage(patternImage);
  if (!check.valid) return { success: false, error: check.error! };
  const prompt = `Apply the pattern shown in the second reference image to the masked region only, tiled at approximately ${Math.round(scalePercent)}% relative scale, rotated ${Math.round(rotationDeg)} degrees, at ${Math.round(brightnessPercent)}% brightness. The pattern must follow the garment's real fabric folds, shadows, and highlights — it must not look like a flat rectangle pasted on top. ${PRESERVE_INSTRUCTION}`;
  return applyEditAndPersist(designId, [currentImage, patternImage], mask, prompt, "Apply pattern");
}

export async function applyPrintLogoAction(
  designId: string,
  currentImage: Blob,
  mask: Blob,
  logoImage: Blob,
  scalePercent: number,
  rotationDeg: number,
  brightnessPercent: number
): Promise<ActionResult<{ versionId: string; image: string }>> {
  const check = checkUploadedImage(logoImage);
  if (!check.valid) return { success: false, error: check.error! };
  const prompt = `Apply the print/logo shown in the second reference image onto the masked region only, at approximately ${Math.round(scalePercent)}% relative scale, rotated ${Math.round(rotationDeg)} degrees, at ${Math.round(brightnessPercent)}% brightness. Integrate it realistically into the garment's fabric — follow its folds, shadows and perspective, don't leave it as a flat overlay. ${PRESERVE_INSTRUCTION}`;
  return applyEditAndPersist(designId, [currentImage, logoImage], mask, prompt, "Apply print/logo");
}

export async function colorizeRegionAction(
  designId: string,
  currentImage: Blob,
  mask: Blob,
  colorHex: string,
  brightnessPercent: number
): Promise<ActionResult<{ versionId: string; image: string }>> {
  const prompt = `Recolor the masked region to ${colorHex} at approximately ${Math.round(brightnessPercent)}% brightness. Preserve the fabric's texture, folds, shadows and highlights — do not flat-fill the region, keep it looking like real dyed fabric. ${PRESERVE_INSTRUCTION}`;
  return applyEditAndPersist(designId, currentImage, mask, prompt, "Colorize");
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
