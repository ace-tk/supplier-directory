"use server";

// Design Studio — Hit Collection Proposal. Admin-only, same as Garment Back
// Design and the other AI Design Studio tools. Every AI call goes through
// the one shared engine (lib/ai/openai-client.ts).
//
// Two real, sequential AI steps per generation, the same shape as Garment
// Back Design: a vision read of the uploaded bestseller photo(s) — its
// "design language" — then one image-conditioned generation that returns a
// single sheet holding the whole grid of variations. The analysis text is
// injected into the generation prompt as explicit grounding, so the
// variations keep what makes the bestseller recognisable.

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { runVisionChatCompletion, editImage, AIConfigError } from "@/lib/ai/openai-client";
import { validateImage } from "@/lib/file-validation";
import {
  buildHitCollectionPrompt,
  clampGrid,
  gridLayout,
  HIT_ANALYSIS_SYSTEM_PROMPT,
  HIT_MAX_IMAGES,
  isHitOutputFormat,
  isHitStyleCategory,
  validateHitRequest,
  type HitOutputFormat,
  type HitStyleCategory,
} from "@/lib/hit-collection";

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
  if (!match) throw new Error("Invalid bestseller image data.");
  return new Blob([Buffer.from(match[2], "base64")], { type: match[1] });
}

/** Server Actions carry files in a FormData; this reads the "images" entries back as Blobs, in order. */
function imagesOf(form: FormData): Blob[] {
  return form.getAll("images").filter((v): v is File => typeof v !== "string");
}

function checkImages(images: Blob[]): string | null {
  if (!images.length) return "Upload at least one bestseller image.";
  if (images.length > HIT_MAX_IMAGES) return `Upload at most ${HIT_MAX_IMAGES} images.`;
  for (const img of images) {
    const check = validateImage(img.type, img.size);
    if (!check.valid) return check.error!;
  }
  return null;
}

/** Stage 1 — a real vision read of the bestseller photo(s): its design language, in words. */
export async function analyzeBestsellerAction(form: FormData): Promise<ActionResult<string>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const images = imagesOf(form);
  const problem = checkImages(images);
  if (problem) return { success: false, error: problem };

  return withAiErrorHandling(async () => {
    const dataUrls = await Promise.all(images.map(blobToDataUrl));
    const category = form.get("styleCategory");
    const text = await runVisionChatCompletion({
      system: HIT_ANALYSIS_SYSTEM_PROMPT,
      user: `Describe the design language of this bestseller${isHitStyleCategory(category) ? ` (category: ${category})` : ""}.`,
      images: dataUrls,
      maxTokens: 260,
    });
    return text.trim();
  });
}

export interface HitCollectionVersionRecord {
  id: string;
  image: string;
  outputFormat: HitOutputFormat;
  gridCount: number;
  createdAt: string;
}

export interface HitCollectionDetail {
  id: string;
  name: string;
  sourceImages: string[];
  styleCategory: HitStyleCategory;
  analysis: string | null;
  versions: HitCollectionVersionRecord[];
}

export interface HitCollectionSummary {
  id: string;
  name: string;
  styleCategory: string;
  /** The first bestseller photo and the newest result, for the history list. */
  thumbnail: string | null;
  latest: string | null;
  versions: number;
  updatedAt: string;
}

async function generateSheet(images: Blob[], styleCategory: HitStyleCategory, outputFormat: HitOutputFormat, gridCount: number, analysis: string): Promise<string> {
  return editImage({
    image: images,
    prompt: buildHitCollectionPrompt({ styleCategory, outputFormat, gridCount, analysis, imageCount: images.length }),
    size: gridLayout(gridCount, outputFormat).size,
  });
}

/**
 * Stage 2 (first generation) — creates the proposal and its first version.
 * The uploads are stored exactly as sent, so Regenerate and reopening
 * always condition on the same untouched bestseller photos.
 */
export async function generateHitCollectionAction(form: FormData): Promise<ActionResult<{ id: string; version: HitCollectionVersionRecord }>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const images = imagesOf(form);
  const styleCategory = form.get("styleCategory");
  const outputFormat = form.get("outputFormat");
  const gridCount = Number(form.get("gridCount"));
  const analysis = String(form.get("analysis") ?? "").trim();
  const problem = checkImages(images) ?? validateHitRequest({ imageCount: images.length, styleCategory, outputFormat, gridCount });
  if (problem) return { success: false, error: problem };
  if (!analysis) return { success: false, error: "The bestseller has not been analysed yet." };
  if (!isHitStyleCategory(styleCategory) || !isHitOutputFormat(outputFormat)) return { success: false, error: "Choose a style category and an output format." };

  return withAiErrorHandling(async () => {
    const grid = clampGrid(gridCount);
    const image = await generateSheet(images, styleCategory, outputFormat, grid, analysis);
    const sourceImages = await Promise.all(images.map(blobToDataUrl));
    const proposal = await db.hitCollectionProposal.create({
      data: {
        ownerId: admin.id,
        name: `${styleCategory} collection`,
        sourceImages,
        styleCategory,
        analysis,
        versions: { create: [{ image, outputFormat, gridCount: grid, order: 0 }] },
      },
      select: { id: true, versions: { select: { id: true, createdAt: true } } },
    });
    const v = proposal.versions[0];
    return { id: proposal.id, version: { id: v.id, image, outputFormat, gridCount: grid, createdAt: v.createdAt.toISOString() } };
  });
}

/**
 * Stage 2 (Regenerate, or a new format / grid count) — reuses the stored
 * bestseller photos and analysis, and always appends a new version; an
 * earlier result is never overwritten.
 */
export async function regenerateHitCollectionAction(proposalId: string, outputFormat: HitOutputFormat, gridCount: number): Promise<ActionResult<HitCollectionVersionRecord>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const proposal = await db.hitCollectionProposal.findUnique({ where: { id: proposalId } });
  if (!proposal) return { success: false, error: "Collection not found." };
  const problem = validateHitRequest({ imageCount: proposal.sourceImages.length, styleCategory: proposal.styleCategory, outputFormat, gridCount });
  if (problem) return { success: false, error: problem };
  if (!isHitStyleCategory(proposal.styleCategory)) return { success: false, error: "This collection has no valid style category." };
  const category = proposal.styleCategory;

  return withAiErrorHandling(async () => {
    const grid = clampGrid(gridCount);
    const image = await generateSheet(proposal.sourceImages.map(dataUrlToBlob), category, outputFormat, grid, proposal.analysis ?? "");
    const count = await db.hitCollectionProposalVersion.count({ where: { proposalId } });
    const v = await db.hitCollectionProposalVersion.create({ data: { proposalId, image, outputFormat, gridCount: grid, order: count }, select: { id: true, createdAt: true } });
    await db.hitCollectionProposal.update({ where: { id: proposalId }, data: { updatedAt: new Date() } });
    return { id: v.id, image, outputFormat, gridCount: grid, createdAt: v.createdAt.toISOString() };
  });
}

export async function getHitCollectionAction(id: string): Promise<ActionResult<HitCollectionDetail>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const p = await db.hitCollectionProposal.findUnique({ where: { id }, include: { versions: { orderBy: { order: "asc" } } } });
  if (!p) return { success: false, error: "Collection not found." };
  return {
    success: true,
    data: {
      id: p.id,
      name: p.name,
      sourceImages: p.sourceImages,
      styleCategory: isHitStyleCategory(p.styleCategory) ? p.styleCategory : "Tops",
      analysis: p.analysis,
      versions: p.versions.map((v) => ({ id: v.id, image: v.image, outputFormat: isHitOutputFormat(v.outputFormat) ? v.outputFormat : "on-model", gridCount: v.gridCount, createdAt: v.createdAt.toISOString() })),
    },
  };
}

/** The admin's saved collections, newest first (the "History" tab). */
export async function listHitCollectionsAction(): Promise<ActionResult<HitCollectionSummary[]>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const rows = await db.hitCollectionProposal.findMany({
    where: { ownerId: admin.id },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { id: true, name: true, styleCategory: true, sourceImages: true, updatedAt: true, _count: { select: { versions: true } }, versions: { orderBy: { order: "desc" }, take: 1, select: { image: true } } },
  });
  return {
    success: true,
    data: rows.map((r) => ({ id: r.id, name: r.name, styleCategory: r.styleCategory, thumbnail: r.sourceImages[0] ?? null, latest: r.versions[0]?.image ?? null, versions: r._count.versions, updatedAt: r.updatedAt.toISOString() })),
  };
}

export async function deleteHitCollectionAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const p = await db.hitCollectionProposal.findUnique({ where: { id }, select: { ownerId: true } });
  if (!p || p.ownerId !== admin.id) return { success: false, error: "Collection not found." };
  await db.hitCollectionProposal.delete({ where: { id } });
  return { success: true, data: undefined };
}
