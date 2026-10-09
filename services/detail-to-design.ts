"use server";

// Design Studio — Detail to Design. Admin-only, like the other AI Design
// Studio tools, and every AI call goes through the one shared engine
// (lib/ai/openai-client.ts).
//
// Two real, sequential AI steps, the same shape as Hit Collection: a vision
// read of the uploaded detail photo (what the detail is and how it is built),
// then one image-conditioned generation that returns a single sheet of
// concepts that all feature that detail. The read is injected into the
// generation prompt so the detail is reproduced, not reinterpreted.

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { runVisionChatCompletion, editImage, AIConfigError } from "@/lib/ai/openai-client";
import { validateImage } from "@/lib/file-validation";
import { gridLayout } from "@/lib/hit-collection";
import {
  clampDetailCount,
  isDetailOutputFormat,
  isDetailStyleCategory,
  isReferenceKind,
  REFERENCE_PROMPTS,
  validateDetailRequest,
  type DetailOutputFormat,
  type DetailStyleCategory,
  type ReferenceKind,
} from "@/lib/detail-to-design";

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
  if (!match) throw new Error("Invalid detail image data.");
  return new Blob([Buffer.from(match[2], "base64")], { type: match[1] });
}

/** Server Actions carry files in a FormData; this reads the "images" entries back as Blobs. */
function imagesOf(form: FormData): Blob[] {
  return form.getAll("images").filter((v): v is File => typeof v !== "string");
}

function checkImage(images: Blob[]): string | null {
  if (!images.length) return "Upload a detail image.";
  if (images.length > 1) return "Upload one detail image at a time.";
  const check = validateImage(images[0].type, images[0].size);
  return check.valid ? null : check.error!;
}

/** Detail to Design and Fabric to Design share this engine; the form says which one is calling. */
function kindOf(form: FormData): ReferenceKind {
  const k = form.get("kind");
  return isReferenceKind(k) ? k : "detail";
}

/** Stage 1 — a real vision read of the reference photo (a detail or a fabric). */
export async function analyzeDetailAction(form: FormData): Promise<ActionResult<string>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const images = imagesOf(form);
  const problem = checkImage(images);
  if (problem) return { success: false, error: problem };

  return withAiErrorHandling(async () => {
    const dataUrl = await blobToDataUrl(images[0]);
    const category = form.get("styleCategory");
    const kind = kindOf(form);
    const text = await runVisionChatCompletion({
      system: REFERENCE_PROMPTS[kind].analysis,
      user: `Describe this ${REFERENCE_PROMPTS[kind].noun}${isDetailStyleCategory(category) ? ` (it will be used for ${category.toLowerCase()})` : ""}.`,
      images: [dataUrl],
      maxTokens: 220,
    });
    return text.trim();
  });
}

export interface DetailDesignVersionRecord {
  id: string;
  image: string;
  outputFormat: DetailOutputFormat;
  designCount: number;
  createdAt: string;
}

export interface DetailDesignDetail {
  id: string;
  kind: ReferenceKind;
  name: string;
  sourceImage: string;
  styleCategory: DetailStyleCategory;
  referenceStyle: string;
  analysis: string | null;
  versions: DetailDesignVersionRecord[];
}

export interface DetailDesignSummary {
  id: string;
  name: string;
  styleCategory: string;
  /** The detail photo and the newest result, for the history list. */
  thumbnail: string | null;
  latest: string | null;
  versions: number;
  updatedAt: string;
}

async function generateSheet(kind: ReferenceKind, image: Blob, styleCategory: DetailStyleCategory, outputFormat: DetailOutputFormat, count: number, analysis: string, referenceStyle: string): Promise<string> {
  return editImage({
    image: [image],
    prompt: REFERENCE_PROMPTS[kind].build({ styleCategory, outputFormat, count, analysis, referenceStyle }),
    size: gridLayout(count, outputFormat).size,
  });
}

/** Stage 2 (first generation) — creates the design and its first version. The upload is stored exactly as sent. */
export async function generateDetailDesignAction(form: FormData): Promise<ActionResult<{ id: string; version: DetailDesignVersionRecord }>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const images = imagesOf(form);
  const styleCategory = form.get("styleCategory");
  const outputFormat = form.get("outputFormat");
  const count = Number(form.get("designCount"));
  const referenceStyle = String(form.get("referenceStyle") ?? "").trim();
  const analysis = String(form.get("analysis") ?? "").trim();
  const kind = kindOf(form);
  const problem = checkImage(images) ?? validateDetailRequest({ imageCount: images.length, styleCategory, outputFormat, count, referenceStyle });
  if (problem) return { success: false, error: problem };
  if (!analysis) return { success: false, error: `The ${REFERENCE_PROMPTS[kind].noun} has not been analysed yet.` };
  if (!isDetailStyleCategory(styleCategory) || !isDetailOutputFormat(outputFormat)) return { success: false, error: "Choose a style category and an output type." };

  return withAiErrorHandling(async () => {
    const n = clampDetailCount(count);
    const image = await generateSheet(kind, images[0], styleCategory, outputFormat, n, analysis, referenceStyle);
    const sourceImage = await blobToDataUrl(images[0]);
    const design = await db.detailDesign.create({
      data: {
        ownerId: admin.id,
        kind,
        name: kind === "fabric" ? `${styleCategory} fabric design` : `${styleCategory} detail design`,
        sourceImage,
        styleCategory,
        referenceStyle: referenceStyle || null,
        analysis,
        versions: { create: [{ image, outputFormat, designCount: n, order: 0 }] },
      },
      select: { id: true, versions: { select: { id: true, createdAt: true } } },
    });
    const v = design.versions[0];
    return { id: design.id, version: { id: v.id, image, outputFormat, designCount: n, createdAt: v.createdAt.toISOString() } };
  });
}

/** Stage 2 (Regenerate, or a new output type / count) — reuses the stored photo and analysis and always appends a new version. */
export async function regenerateDetailDesignAction(designId: string, outputFormat: DetailOutputFormat, designCount: number, referenceStyle?: string): Promise<ActionResult<DetailDesignVersionRecord>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const design = await db.detailDesign.findUnique({ where: { id: designId } });
  if (!design || design.ownerId !== admin.id) return { success: false, error: "Detail design not found." };
  const style = (referenceStyle ?? design.referenceStyle ?? "").trim();
  const problem = validateDetailRequest({ imageCount: 1, styleCategory: design.styleCategory, outputFormat, count: designCount, referenceStyle: style });
  if (problem) return { success: false, error: problem };
  if (!isDetailStyleCategory(design.styleCategory)) return { success: false, error: "This design has no valid style category." };
  const category = design.styleCategory;
  const kind: ReferenceKind = isReferenceKind(design.kind) ? design.kind : "detail";

  return withAiErrorHandling(async () => {
    const n = clampDetailCount(designCount);
    const image = await generateSheet(kind, dataUrlToBlob(design.sourceImage), category, outputFormat, n, design.analysis ?? "", style);
    const count = await db.detailDesignVersion.count({ where: { designId } });
    const v = await db.detailDesignVersion.create({ data: { designId, image, outputFormat, designCount: n, order: count }, select: { id: true, createdAt: true } });
    await db.detailDesign.update({ where: { id: designId }, data: { updatedAt: new Date(), referenceStyle: style || null } });
    return { id: v.id, image, outputFormat, designCount: n, createdAt: v.createdAt.toISOString() };
  });
}

export async function getDetailDesignAction(id: string): Promise<ActionResult<DetailDesignDetail>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const d = await db.detailDesign.findUnique({ where: { id }, include: { versions: { orderBy: { order: "asc" } } } });
  if (!d || d.ownerId !== admin.id) return { success: false, error: "Detail design not found." };
  return {
    success: true,
    data: {
      id: d.id,
      kind: isReferenceKind(d.kind) ? d.kind : "detail",
      name: d.name,
      sourceImage: d.sourceImage,
      styleCategory: isDetailStyleCategory(d.styleCategory) ? d.styleCategory : "Tops",
      referenceStyle: d.referenceStyle ?? "",
      analysis: d.analysis,
      versions: d.versions.map((v) => ({ id: v.id, image: v.image, outputFormat: isDetailOutputFormat(v.outputFormat) ? v.outputFormat : "on-model", designCount: v.designCount, createdAt: v.createdAt.toISOString() })),
    },
  };
}

/** The admin's saved detail designs, newest first (the "History" tab). */
export async function listDetailDesignsAction(kind: ReferenceKind = "detail"): Promise<ActionResult<DetailDesignSummary[]>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const rows = await db.detailDesign.findMany({
    where: { ownerId: admin.id, kind },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { id: true, name: true, styleCategory: true, sourceImage: true, updatedAt: true, _count: { select: { versions: true } }, versions: { orderBy: { order: "desc" }, take: 1, select: { image: true } } },
  });
  return {
    success: true,
    data: rows.map((r) => ({ id: r.id, name: r.name, styleCategory: r.styleCategory, thumbnail: r.sourceImage, latest: r.versions[0]?.image ?? null, versions: r._count.versions, updatedAt: r.updatedAt.toISOString() })),
  };
}

export async function deleteDetailDesignAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const d = await db.detailDesign.findUnique({ where: { id }, select: { ownerId: true } });
  if (!d || d.ownerId !== admin.id) return { success: false, error: "Detail design not found." };
  await db.detailDesign.delete({ where: { id } });
  return { success: true, data: undefined };
}
