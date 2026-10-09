"use server";

// Design Studio — Image to Design. Admin-only, like the other AI Design
// Studio tools; every AI call goes through the one shared engine
// (lib/ai/openai-client.ts).
//
// Two real AI steps: one vision read of the uploaded garment (its description
// plus the suggestions for the Target Style / Common Block Elements pickers),
// then 1-4 image-conditioned generations, one per image, run side by side so
// each is its own interpretation. The read is injected into every prompt.

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { runVisionChatCompletion, editImage, AIConfigError } from "@/lib/ai/openai-client";
import { validateImage } from "@/lib/file-validation";
import {
  buildImageDesignPrompt,
  clampImageCount,
  imageQuality,
  IMAGE_READ_SYSTEM_PROMPT,
  isImageDirection,
  isImageMode,
  isImageSize,
  isImageStyleCategory,
  parseImageRead,
  validateImageDesignRequest,
  type ImageDirection,
  type ImageMode,
  type ImageRead,
  type ImageSize,
} from "@/lib/image-to-design";

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

function imagesOf(form: FormData): Blob[] {
  return form.getAll("images").filter((v): v is File => typeof v !== "string");
}

function checkImage(images: Blob[]): string | null {
  if (!images.length) return "Upload a style image.";
  if (images.length > 1) return "Upload one style image at a time.";
  const check = validateImage(images[0].type, images[0].size);
  return check.valid ? null : check.error!;
}

function jsonList(v: FormDataEntryValue | null): string[] {
  if (typeof v !== "string" || !v) return [];
  try {
    const data = JSON.parse(v);
    return Array.isArray(data) ? data.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Stage 1 — one real vision read: the garment's description and the picker suggestions. */
export async function readImageAction(form: FormData): Promise<ActionResult<ImageRead>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const images = imagesOf(form);
  const problem = checkImage(images);
  if (problem) return { success: false, error: problem };

  return withAiErrorHandling(async () => {
    const category = form.get("styleCategory");
    const text = await runVisionChatCompletion({
      system: IMAGE_READ_SYSTEM_PROMPT,
      user: `Read this garment${isImageStyleCategory(category) ? ` (category: ${category})` : ""}.`,
      images: [await blobToDataUrl(images[0])],
      maxTokens: 500,
      json: true,
    });
    return parseImageRead(text);
  });
}

export interface ImageDesignSettings {
  direction: ImageDirection;
  target: string;
  blocks: string[];
  description: string;
  mode: ImageMode;
  size: ImageSize;
  count: number;
}

export interface ImageVersionRecord extends ImageDesignSettings {
  id: string;
  images: string[];
  createdAt: string;
}

export interface ImageDesignDetail {
  id: string;
  name: string;
  sourceImage: string;
  styleCategory: string;
  analysis: string | null;
  styleOptions: string[];
  blockOptions: string[];
  versions: ImageVersionRecord[];
}

export interface ImageDesignSummary {
  id: string;
  name: string;
  /** The garment photo and the newest result, for the history list. */
  thumbnail: string | null;
  latest: string | null;
  versions: number;
  updatedAt: string;
}

/** Makes `count` images side by side. A failure of some keeps the rest; all failing is an error. */
async function generateImages(source: Blob, s: ImageDesignSettings, styleCategory: string, analysis: string): Promise<string[]> {
  const count = clampImageCount(s.count);
  const results = await Promise.allSettled(
    Array.from({ length: count }, (_, i) =>
      editImage({
        image: [source],
        prompt: buildImageDesignPrompt({
          direction: s.direction,
          target: s.target || undefined,
          blocks: s.blocks,
          description: s.description,
          styleCategory: styleCategory || undefined,
          analysis,
          index: i + 1,
          total: count,
        }),
        size: s.size,
        quality: imageQuality(s.mode),
      })
    )
  );
  const ok = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (!ok.length) {
    const first = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    throw first?.reason instanceof Error ? first.reason : new Error("The AI didn't return an image. Please try again.");
  }
  return ok;
}

function settingsFromForm(form: FormData): ImageDesignSettings & { styleCategory: string } {
  return {
    direction: form.get("direction") as ImageDirection,
    target: String(form.get("target") ?? "").trim(),
    blocks: jsonList(form.get("blocks")),
    description: String(form.get("description") ?? "").trim(),
    mode: form.get("mode") as ImageMode,
    size: form.get("size") as ImageSize,
    count: Number(form.get("count")),
    styleCategory: String(form.get("styleCategory") ?? "").trim(),
  };
}

/** Stage 2 (first generation) — creates the design and its first version. The upload is stored exactly as sent. */
export async function generateImageDesignAction(form: FormData): Promise<ActionResult<{ id: string; version: ImageVersionRecord }>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const images = imagesOf(form);
  const s = settingsFromForm(form);
  const analysis = String(form.get("analysis") ?? "").trim();
  const problem = checkImage(images) ?? validateImageDesignRequest({ imageCount: images.length, ...s });
  if (problem) return { success: false, error: problem };
  if (!analysis) return { success: false, error: "The garment has not been read yet." };

  return withAiErrorHandling(async () => {
    const generated = await generateImages(images[0], s, s.styleCategory, analysis);
    const sourceImage = await blobToDataUrl(images[0]);
    const design = await db.imageDesign.create({
      data: {
        ownerId: admin.id,
        name: s.direction === "category" ? `Redesign as ${s.target.toLowerCase()}` : s.direction === "style" ? `${s.target || "New style"} redesign` : s.direction === "shape" ? "Shape redesign" : "Custom redesign",
        sourceImage,
        styleCategory: s.styleCategory || null,
        analysis,
        styleOptions: jsonList(form.get("styleOptions")),
        blockOptions: jsonList(form.get("blockOptions")),
        versions: { create: [{ images: generated, direction: s.direction, target: s.target || null, blocks: s.blocks, description: s.description || null, mode: s.mode, size: s.size, order: 0 }] },
      },
      select: { id: true, versions: { select: { id: true, createdAt: true } } },
    });
    const v = design.versions[0];
    return { id: design.id, version: { id: v.id, images: generated, direction: s.direction, target: s.target, blocks: s.blocks, description: s.description, mode: s.mode, size: s.size, count: s.count, createdAt: v.createdAt.toISOString() } };
  });
}

/** Stage 2 (Regenerate, or a new direction / settings) — reuses the stored photo and read, always appends a new version. */
export async function regenerateImageDesignAction(designId: string, settings: ImageDesignSettings): Promise<ActionResult<ImageVersionRecord>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const design = await db.imageDesign.findUnique({ where: { id: designId } });
  if (!design || design.ownerId !== admin.id) return { success: false, error: "Image design not found." };
  const problem = validateImageDesignRequest({ imageCount: 1, ...settings, styleCategory: design.styleCategory ?? "" });
  if (problem) return { success: false, error: problem };

  return withAiErrorHandling(async () => {
    const generated = await generateImages(dataUrlToBlob(design.sourceImage), settings, design.styleCategory ?? "", design.analysis ?? "");
    const order = await db.imageDesignVersion.count({ where: { designId } });
    const v = await db.imageDesignVersion.create({
      data: { designId, images: generated, direction: settings.direction, target: settings.target || null, blocks: settings.blocks, description: settings.description || null, mode: settings.mode, size: settings.size, order },
      select: { id: true, createdAt: true },
    });
    await db.imageDesign.update({ where: { id: designId }, data: { updatedAt: new Date() } });
    return { ...settings, id: v.id, images: generated, createdAt: v.createdAt.toISOString() };
  });
}

export async function getImageDesignAction(id: string): Promise<ActionResult<ImageDesignDetail>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const d = await db.imageDesign.findUnique({ where: { id }, include: { versions: { orderBy: { order: "asc" } } } });
  if (!d || d.ownerId !== admin.id) return { success: false, error: "Image design not found." };
  return {
    success: true,
    data: {
      id: d.id,
      name: d.name,
      sourceImage: d.sourceImage,
      styleCategory: d.styleCategory ?? "",
      analysis: d.analysis,
      styleOptions: d.styleOptions,
      blockOptions: d.blockOptions,
      versions: d.versions
        .filter((v) => isImageDirection(v.direction))
        .map((v) => ({
          id: v.id,
          images: v.images,
          direction: v.direction as ImageDirection,
          target: v.target ?? "",
          blocks: v.blocks,
          description: v.description ?? "",
          mode: isImageMode(v.mode) ? v.mode : "standard",
          size: isImageSize(v.size) ? v.size : "1024x1024",
          count: v.images.length,
          createdAt: v.createdAt.toISOString(),
        })),
    },
  };
}

/** The admin's saved image designs, newest first (the "History" tab). */
export async function listImageDesignsAction(): Promise<ActionResult<ImageDesignSummary[]>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const rows = await db.imageDesign.findMany({
    where: { ownerId: admin.id },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { id: true, name: true, sourceImage: true, updatedAt: true, _count: { select: { versions: true } }, versions: { orderBy: { order: "desc" }, take: 1, select: { images: true } } },
  });
  return {
    success: true,
    data: rows.map((r) => ({ id: r.id, name: r.name, thumbnail: r.sourceImage, latest: r.versions[0]?.images[0] ?? null, versions: r._count.versions, updatedAt: r.updatedAt.toISOString() })),
  };
}

export async function deleteImageDesignAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const d = await db.imageDesign.findUnique({ where: { id }, select: { ownerId: true } });
  if (!d || d.ownerId !== admin.id) return { success: false, error: "Image design not found." };
  await db.imageDesign.delete({ where: { id } });
  return { success: true, data: undefined };
}
