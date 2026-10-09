"use server";

// Design Studio — Graphic Extractor. Admin-only, like the other AI Design
// Studio tools; every AI call goes through the one shared engine
// (lib/ai/openai-client.ts).
//
// Three real steps. (1) One vision read finds the graphic on the photo and
// describes it — and says so plainly when there is none, before any image
// credit is spent. (2) 1-4 image-conditioned extractions are made side by
// side. (3) With "Background Transparent" on, the plain background is removed
// for real (lib/background-remove.ts) and a PNG with alpha is saved.

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { runVisionChatCompletion, editImage, AIConfigError } from "@/lib/ai/openai-client";
import { validateImage } from "@/lib/file-validation";
import { makeBackgroundTransparent } from "@/lib/background-remove-server";
import {
  buildExtractPrompt,
  clampExtractCount,
  EXTRACT_DETECT_SYSTEM_PROMPT,
  extractQuality,
  isExtractMode,
  isExtractSize,
  NO_GRAPHIC_MESSAGE,
  parseGraphicDetection,
  validateExtractRequest,
  type ExtractMode,
  type ExtractSize,
  type GraphicDetection,
} from "@/lib/graphic-extractor";

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

/** Stage 1 — finds the graphic on the photo. A photo with nothing to extract is reported as an error. */
export async function detectGraphicAction(form: FormData): Promise<ActionResult<GraphicDetection>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const images = imagesOf(form);
  const problem = checkImage(images);
  if (problem) return { success: false, error: problem };

  const result = await withAiErrorHandling(async () => {
    const text = await runVisionChatCompletion({
      system: EXTRACT_DETECT_SYSTEM_PROMPT,
      user: "Find the graphic or pattern on this garment or product.",
      images: [await blobToDataUrl(images[0])],
      maxTokens: 400,
      json: true,
    });
    return parseGraphicDetection(text);
  });
  if (result.success && !result.data.found) return { success: false, error: result.data.reason ? `${NO_GRAPHIC_MESSAGE} (${result.data.reason})` : NO_GRAPHIC_MESSAGE };
  return result;
}

export interface ExtractSettings {
  removeCraft: boolean;
  transparent: boolean;
  mode: ExtractMode;
  size: ExtractSize;
  count: number;
}

export interface ExtractVersionRecord extends ExtractSettings {
  id: string;
  images: string[];
  createdAt: string;
  /** Shown once after a run; not stored. */
  warning?: string;
}

export interface GraphicExtractionDetail {
  id: string;
  name: string;
  sourceImage: string;
  kind: string;
  description: string;
  hasCraft: boolean;
  versions: ExtractVersionRecord[];
}

export interface GraphicExtractionSummary {
  id: string;
  name: string;
  /** The photo and the newest result, for the history list. */
  thumbnail: string | null;
  latest: string | null;
  versions: number;
  updatedAt: string;
}

/** Makes `count` extractions side by side; a failure of some keeps the rest, all failing is an error. */
async function extractImages(source: Blob, s: ExtractSettings, description: string, kind: string): Promise<{ images: string[]; warning?: string }> {
  const count = clampExtractCount(s.count);
  const prompt = buildExtractPrompt({ removeCraft: s.removeCraft, transparent: s.transparent, description, kind });
  const results = await Promise.allSettled(Array.from({ length: count }, () => editImage({ image: [source], prompt, size: s.size, quality: extractQuality(s.mode) })));
  const ok = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (!ok.length) {
    const first = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    throw first?.reason instanceof Error ? first.reason : new Error("The AI didn't return an image. Please try again.");
  }
  if (!s.transparent) return { images: ok };

  const finished = await Promise.all(ok.map((img) => makeBackgroundTransparent(img).catch(() => ({ image: img, removed: false }))));
  const kept = finished.filter((f) => f.removed).length;
  return {
    images: finished.map((f) => f.image),
    warning: kept === finished.length ? undefined : kept === 0 ? "The background couldn't be removed cleanly, so the images keep their plain background." : `The background was removed from ${kept} of ${finished.length} images.`,
  };
}

function settingsFromForm(form: FormData): ExtractSettings {
  return {
    removeCraft: form.get("removeCraft") === "true",
    transparent: form.get("transparent") === "true",
    mode: form.get("mode") as ExtractMode,
    size: form.get("size") as ExtractSize,
    count: Number(form.get("count")),
  };
}

/** Stage 2 (first run) — creates the extraction and its first version. The upload is stored exactly as sent. */
export async function extractGraphicAction(form: FormData): Promise<ActionResult<{ id: string; version: ExtractVersionRecord }>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const images = imagesOf(form);
  const s = settingsFromForm(form);
  const description = String(form.get("description") ?? "").trim();
  const kind = String(form.get("kind") ?? "").trim();
  const hasCraft = form.get("hasCraft") === "true";
  const problem = checkImage(images) ?? validateExtractRequest({ imageCount: images.length, ...s });
  if (problem) return { success: false, error: problem };
  if (!description) return { success: false, error: "The graphic has not been detected yet." };

  return withAiErrorHandling(async () => {
    const { images: generated, warning } = await extractImages(images[0], s, description, kind);
    const sourceImage = await blobToDataUrl(images[0]);
    const row = await db.graphicExtraction.create({
      data: {
        ownerId: admin.id,
        name: kind ? `Extracted ${kind}` : "Extracted graphic",
        sourceImage,
        kind: kind || null,
        description,
        hasCraft,
        versions: { create: [{ images: generated, removeCraft: s.removeCraft, transparent: s.transparent, mode: s.mode, size: s.size, order: 0 }] },
      },
      select: { id: true, versions: { select: { id: true, createdAt: true } } },
    });
    const v = row.versions[0];
    return { id: row.id, version: { ...s, id: v.id, images: generated, createdAt: v.createdAt.toISOString(), warning } };
  });
}

/** Stage 2 (run again, with the same or changed options) — reuses the stored photo and read, always appends a new version. */
export async function reextractGraphicAction(extractionId: string, settings: ExtractSettings): Promise<ActionResult<ExtractVersionRecord>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const row = await db.graphicExtraction.findUnique({ where: { id: extractionId } });
  if (!row || row.ownerId !== admin.id) return { success: false, error: "Extraction not found." };
  const problem = validateExtractRequest({ imageCount: 1, ...settings });
  if (problem) return { success: false, error: problem };

  return withAiErrorHandling(async () => {
    const { images: generated, warning } = await extractImages(dataUrlToBlob(row.sourceImage), settings, row.description ?? "", row.kind ?? "");
    const order = await db.graphicExtractionVersion.count({ where: { extractionId } });
    const v = await db.graphicExtractionVersion.create({
      data: { extractionId, images: generated, removeCraft: settings.removeCraft, transparent: settings.transparent, mode: settings.mode, size: settings.size, order },
      select: { id: true, createdAt: true },
    });
    await db.graphicExtraction.update({ where: { id: extractionId }, data: { updatedAt: new Date() } });
    return { ...settings, id: v.id, images: generated, createdAt: v.createdAt.toISOString(), warning };
  });
}

export async function getGraphicExtractionAction(id: string): Promise<ActionResult<GraphicExtractionDetail>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const d = await db.graphicExtraction.findUnique({ where: { id }, include: { versions: { orderBy: { order: "asc" } } } });
  if (!d || d.ownerId !== admin.id) return { success: false, error: "Extraction not found." };
  return {
    success: true,
    data: {
      id: d.id,
      name: d.name,
      sourceImage: d.sourceImage,
      kind: d.kind ?? "",
      description: d.description ?? "",
      hasCraft: d.hasCraft,
      versions: d.versions.map((v) => ({
        id: v.id,
        images: v.images,
        removeCraft: v.removeCraft,
        transparent: v.transparent,
        mode: isExtractMode(v.mode) ? v.mode : "standard",
        size: isExtractSize(v.size) ? v.size : "1024x1024",
        count: v.images.length,
        createdAt: v.createdAt.toISOString(),
      })),
    },
  };
}

/** The admin's saved extractions, newest first (the "History" tab). */
export async function listGraphicExtractionsAction(): Promise<ActionResult<GraphicExtractionSummary[]>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const rows = await db.graphicExtraction.findMany({
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

export async function deleteGraphicExtractionAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const d = await db.graphicExtraction.findUnique({ where: { id }, select: { ownerId: true } });
  if (!d || d.ownerId !== admin.id) return { success: false, error: "Extraction not found." };
  await db.graphicExtraction.delete({ where: { id } });
  return { success: true, data: undefined };
}
