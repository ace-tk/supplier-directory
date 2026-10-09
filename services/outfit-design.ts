"use server";

// Design Studio — Outfit Design. Admin-only, like the other AI Design Studio
// tools; every AI call goes through the one shared engine
// (lib/ai/openai-client.ts).
//
// Two real, sequential AI steps, the same shape as Hit Collection: a vision
// read of the uploaded top or bottom, then one image-conditioned generation
// that returns a single outfit image (the original garment plus a newly
// designed matching piece). The read is injected into the prompt so the
// match is designed around the real garment.

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { runVisionChatCompletion, editImage, AIConfigError } from "@/lib/ai/openai-client";
import { validateImage } from "@/lib/file-validation";
import {
  buildOutfitPrompt,
  isOutfitCategory,
  isOutfitGroup,
  isOutfitMode,
  OUTFIT_ANALYSIS_SYSTEM_PROMPT,
  outfitQuality,
  validateOutfitRequest,
  type OutfitGroup,
  type OutfitMode,
} from "@/lib/outfit-design";

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

function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:(.+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid style image data.");
  return new Blob([Buffer.from(match[2], "base64")], { type: match[1] });
}

/** Server Actions carry files in a FormData; this reads the "images" entries back as Blobs. */
function imagesOf(form: FormData): Blob[] {
  return form.getAll("images").filter((v): v is File => typeof v !== "string");
}

function checkImage(images: Blob[]): string | null {
  if (!images.length) return "Upload a style image.";
  if (images.length > 1) return "Upload one style image at a time.";
  const check = validateImage(images[0].type, images[0].size);
  return check.valid ? null : check.error!;
}

/** Stage 1 — a real vision read of the garment photo. */
export async function analyzeOutfitAction(form: FormData): Promise<ActionResult<string>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const images = imagesOf(form);
  const problem = checkImage(images);
  if (problem) return { success: false, error: problem };

  return withAiErrorHandling(async () => {
    const dataUrl = await blobToDataUrl(images[0]);
    const text = await runVisionChatCompletion({
      system: OUTFIT_ANALYSIS_SYSTEM_PROMPT,
      user: "Describe this garment so a matching piece can be designed for it.",
      images: [dataUrl],
      maxTokens: 220,
    });
    return text.trim();
  });
}

export interface OutfitVersionRecord {
  id: string;
  image: string;
  matchGroup: OutfitGroup;
  matchCategory: string;
  mode: OutfitMode;
  createdAt: string;
}

export interface OutfitDetail {
  id: string;
  name: string;
  sourceImage: string;
  analysis: string | null;
  versions: OutfitVersionRecord[];
}

export interface OutfitSummary {
  id: string;
  name: string;
  /** The garment photo and the newest result, for the history list. */
  thumbnail: string | null;
  latest: string | null;
  versions: number;
  updatedAt: string;
}

async function generateOutfit(source: Blob, group: OutfitGroup, category: string, mode: OutfitMode, analysis: string): Promise<string> {
  return editImage({
    image: [source],
    prompt: buildOutfitPrompt({ match: { group, name: category }, mode, analysis }),
    size: "1024x1536",
    quality: outfitQuality(mode),
  });
}

/** Stage 2 (first generation) — creates the outfit and its first version. The upload is stored exactly as sent. */
export async function generateOutfitAction(form: FormData): Promise<ActionResult<{ id: string; version: OutfitVersionRecord }>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const images = imagesOf(form);
  const group = form.get("group");
  const category = form.get("category");
  const mode = form.get("mode");
  const analysis = String(form.get("analysis") ?? "").trim();
  const problem = checkImage(images) ?? validateOutfitRequest({ imageCount: images.length, group, category, mode });
  if (problem) return { success: false, error: problem };
  if (!analysis) return { success: false, error: "The garment has not been analysed yet." };
  if (!isOutfitGroup(group) || typeof category !== "string" || !isOutfitMode(mode)) return { success: false, error: "Choose a matching category and a generation mode." };

  return withAiErrorHandling(async () => {
    const image = await generateOutfit(images[0], group, category, mode, analysis);
    const sourceImage = await blobToDataUrl(images[0]);
    const outfit = await db.outfitDesign.create({
      data: {
        ownerId: admin.id,
        name: `Outfit with ${category.toLowerCase()}`,
        sourceImage,
        analysis,
        versions: { create: [{ image, matchGroup: group, matchCategory: category, mode, order: 0 }] },
      },
      select: { id: true, versions: { select: { id: true, createdAt: true } } },
    });
    const v = outfit.versions[0];
    return { id: outfit.id, version: { id: v.id, image, matchGroup: group, matchCategory: category, mode, createdAt: v.createdAt.toISOString() } };
  });
}

/** Stage 2 (Regenerate, or another category / mode) — reuses the stored photo and analysis and always appends a new version. */
export async function regenerateOutfitAction(outfitId: string, group: string, category: string, mode: string): Promise<ActionResult<OutfitVersionRecord>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const outfit = await db.outfitDesign.findUnique({ where: { id: outfitId } });
  if (!outfit || outfit.ownerId !== admin.id) return { success: false, error: "Outfit not found." };
  const problem = validateOutfitRequest({ imageCount: 1, group, category, mode });
  if (problem) return { success: false, error: problem };
  if (!isOutfitGroup(group) || !isOutfitMode(mode)) return { success: false, error: "Choose a matching category and a generation mode." };

  return withAiErrorHandling(async () => {
    const image = await generateOutfit(dataUrlToBlob(outfit.sourceImage), group, category, mode, outfit.analysis ?? "");
    const count = await db.outfitDesignVersion.count({ where: { outfitId } });
    const v = await db.outfitDesignVersion.create({ data: { outfitId, image, matchGroup: group, matchCategory: category, mode, order: count }, select: { id: true, createdAt: true } });
    await db.outfitDesign.update({ where: { id: outfitId }, data: { updatedAt: new Date() } });
    return { id: v.id, image, matchGroup: group, matchCategory: category, mode, createdAt: v.createdAt.toISOString() };
  });
}

export async function getOutfitAction(id: string): Promise<ActionResult<OutfitDetail>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const o = await db.outfitDesign.findUnique({ where: { id }, include: { versions: { orderBy: { order: "asc" } } } });
  if (!o || o.ownerId !== admin.id) return { success: false, error: "Outfit not found." };
  return {
    success: true,
    data: {
      id: o.id,
      name: o.name,
      sourceImage: o.sourceImage,
      analysis: o.analysis,
      versions: o.versions
        .filter((v) => isOutfitCategory(v.matchGroup, v.matchCategory))
        .map((v) => ({ id: v.id, image: v.image, matchGroup: v.matchGroup as OutfitGroup, matchCategory: v.matchCategory, mode: isOutfitMode(v.mode) ? v.mode : "standard", createdAt: v.createdAt.toISOString() })),
    },
  };
}

/** The admin's saved outfits, newest first (the "History" tab). */
export async function listOutfitsAction(): Promise<ActionResult<OutfitSummary[]>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const rows = await db.outfitDesign.findMany({
    where: { ownerId: admin.id },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { id: true, name: true, sourceImage: true, updatedAt: true, _count: { select: { versions: true } }, versions: { orderBy: { order: "desc" }, take: 1, select: { image: true } } },
  });
  return {
    success: true,
    data: rows.map((r) => ({ id: r.id, name: r.name, thumbnail: r.sourceImage, latest: r.versions[0]?.image ?? null, versions: r._count.versions, updatedAt: r.updatedAt.toISOString() })),
  };
}

export async function deleteOutfitAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const o = await db.outfitDesign.findUnique({ where: { id }, select: { ownerId: true } });
  if (!o || o.ownerId !== admin.id) return { success: false, error: "Outfit not found." };
  await db.outfitDesign.delete({ where: { id } });
  return { success: true, data: undefined };
}
