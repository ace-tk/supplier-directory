"use server";

// Design Studio — Collection Proposal. Admin-only, same as the other Design
// Studio AI tools. Every AI call goes through the one shared engine
// (lib/ai/openai-client.ts).
//
// The board is built in steps, so no single request waits on the whole
// collection:
//   1. analyzeCollectionAction — one vision read of the bestseller photos
//      → the Core DNA and the look plan (JSON).
//   2. createCollectionAction / createCollectionVersionAction — stores the
//      photos and plan as a version that has no images yet.
//   3. generateLookAction — one image per call, conditioned on the stored
//      photos and that look's description. The client runs these in parallel.
//   4. finishCollectionVersionAction — saves the finished images in board
//      order. A version is only shown once all its looks are saved.
// The board's text (titles, bullets, Core DNA) is stored as data and drawn
// as HTML on the page, never inside an AI image.

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { runVisionChatCompletion, editImage, AIConfigError } from "@/lib/ai/openai-client";
import { validateImage } from "@/lib/file-validation";
import {
  buildCollectionPlanUserPrompt,
  buildLookPrompt,
  clampCollectionCount,
  COLLECTION_PLAN_SYSTEM_PROMPT,
  COLLECTION_MAX_IMAGES,
  LOOK_IMAGE_SIZE,
  parseCollectionPlan,
  validateCollectionRequest,
  type CollectionLook,
  type CollectionPlan,
} from "@/lib/collection-proposal";

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
  if (images.length > COLLECTION_MAX_IMAGES) return `Upload at most ${COLLECTION_MAX_IMAGES} images.`;
  for (const img of images) {
    const check = validateImage(img.type, img.size);
    if (!check.valid) return check.error!;
  }
  return null;
}

export interface CollectionVersionRecord {
  id: string;
  collectionCount: number;
  model: string;
  coreDNA: string[];
  looks: CollectionLook[];
  /** One image per look, in board order. */
  lookImages: string[];
  createdAt: string;
}

export interface CollectionDetail {
  id: string;
  name: string;
  sourceImages: string[];
  /** Only complete versions (every look has its image), oldest first. */
  versions: CollectionVersionRecord[];
}

export interface CollectionSummary {
  id: string;
  name: string;
  /** The first bestseller photo and the newest complete board, for the history list. */
  thumbnail: string | null;
  latest: string | null;
  versions: number;
  updatedAt: string;
}

function isCompleteVersion(v: { collectionCount: number; lookImages: string[] }) {
  return v.lookImages.length === v.collectionCount;
}

/** Stage 1 — a real vision read of the bestseller photo(s): the Core DNA and the look plan. */
export async function analyzeCollectionAction(form: FormData): Promise<ActionResult<CollectionPlan>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const images = imagesOf(form);
  const count = clampCollectionCount(Number(form.get("count")));
  const problem = checkImages(images) ?? validateCollectionRequest({ imageCount: images.length, count });
  if (problem) return { success: false, error: problem };

  return withAiErrorHandling(async () => {
    const dataUrls = await Promise.all(images.map(blobToDataUrl));
    const text = await runVisionChatCompletion({
      system: COLLECTION_PLAN_SYSTEM_PROMPT,
      user: buildCollectionPlanUserPrompt(count, images.length),
      images: dataUrls,
      maxTokens: 1500,
      json: true,
    });
    return parseCollectionPlan(text, count);
  });
}

/** Stage 2 (new collection) — stores the photos and an unfinished first version; returns the ids for the image steps. */
export async function createCollectionAction(form: FormData): Promise<ActionResult<{ proposalId: string; versionId: string; plan: CollectionPlan }>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const images = imagesOf(form);
  const count = clampCollectionCount(Number(form.get("count")));
  const problem = checkImages(images) ?? validateCollectionRequest({ imageCount: images.length, count });
  if (problem) return { success: false, error: problem };

  try {
    const plan = parseCollectionPlan(String(form.get("plan") ?? ""), count);
    const sourceImages = await Promise.all(images.map(blobToDataUrl));
    const proposal = await db.collectionProposal.create({
      data: {
        ownerId: admin.id,
        name: "Collection proposal",
        sourceImages,
        versions: { create: [{ collectionCount: count, model: plan.model, coreDNA: plan.coreDNA, looks: plan.looks, lookImages: [], order: 0 }] },
      },
      select: { id: true, versions: { select: { id: true } } },
    });
    return { success: true, data: { proposalId: proposal.id, versionId: proposal.versions[0].id, plan } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "The collection couldn't be saved." };
  }
}

/**
 * Stage 2 (Regenerate, or a new look count) — adds a version to an existing
 * collection with the given plan. The stored bestseller photos are reused.
 */
export async function createCollectionVersionAction(proposalId: string, count: number, planJson: string): Promise<ActionResult<{ versionId: string; plan: CollectionPlan }>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const proposal = await db.collectionProposal.findUnique({ where: { id: proposalId }, select: { ownerId: true, sourceImages: true } });
  if (!proposal || proposal.ownerId !== admin.id) return { success: false, error: "Collection not found." };
  const problem = validateCollectionRequest({ imageCount: proposal.sourceImages.length, count });
  if (problem) return { success: false, error: problem };

  try {
    const n = clampCollectionCount(count);
    const plan = parseCollectionPlan(planJson, n);
    const order = await db.collectionProposalVersion.count({ where: { proposalId } });
    const v = await db.collectionProposalVersion.create({
      data: { proposalId, collectionCount: n, model: plan.model, coreDNA: plan.coreDNA, looks: plan.looks, lookImages: [], order },
      select: { id: true },
    });
    return { success: true, data: { versionId: v.id, plan } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "The collection couldn't be saved." };
  }
}

/** Stage 3 — one look's image, from the stored bestseller photos and that look's plan. */
export async function generateLookAction(proposalId: string, versionId: string, index: number): Promise<ActionResult<string>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const version = await db.collectionProposalVersion.findUnique({ where: { id: versionId }, include: { proposal: { select: { ownerId: true, sourceImages: true } } } });
  if (!version || version.proposalId !== proposalId || version.proposal.ownerId !== admin.id) return { success: false, error: "Collection not found." };
  const look = (version.looks as unknown as CollectionLook[])[index];
  if (!Number.isInteger(index) || !look) return { success: false, error: "That look isn't part of this collection." };
  const images = version.proposal.sourceImages;

  return withAiErrorHandling(async () => {
    const prompt = buildLookPrompt({
      look,
      plan: { model: version.model, coreDNA: version.coreDNA },
      imageCount: images.length,
    });
    return editImage({ image: images.map(dataUrlToBlob), prompt, size: LOOK_IMAGE_SIZE });
  });
}

/** Stage 4 — saves the finished images in board order. Called once every look has an image. */
export async function finishCollectionVersionAction(proposalId: string, versionId: string, lookImages: string[]): Promise<ActionResult<CollectionVersionRecord>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const version = await db.collectionProposalVersion.findUnique({ where: { id: versionId }, include: { proposal: { select: { ownerId: true } } } });
  if (!version || version.proposalId !== proposalId || version.proposal.ownerId !== admin.id) return { success: false, error: "Collection not found." };
  if (lookImages.length !== version.collectionCount || !lookImages.every((img) => /^data:image\/[a-z+]+;base64,/.test(img))) {
    return { success: false, error: "Not every look has an image yet." };
  }

  const saved = await db.collectionProposalVersion.update({ where: { id: versionId }, data: { lookImages }, select: { id: true, collectionCount: true, model: true, coreDNA: true, looks: true, lookImages: true, createdAt: true } });
  await db.collectionProposal.update({ where: { id: proposalId }, data: { updatedAt: new Date() } });
  return {
    success: true,
    data: { id: saved.id, collectionCount: saved.collectionCount, model: saved.model, coreDNA: saved.coreDNA, looks: saved.looks as unknown as CollectionLook[], lookImages: saved.lookImages, createdAt: saved.createdAt.toISOString() },
  };
}

export async function getCollectionAction(id: string): Promise<ActionResult<CollectionDetail>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const p = await db.collectionProposal.findUnique({ where: { id }, include: { versions: { orderBy: { order: "asc" } } } });
  if (!p || p.ownerId !== admin.id) return { success: false, error: "Collection not found." };
  return {
    success: true,
    data: {
      id: p.id,
      name: p.name,
      sourceImages: p.sourceImages,
      versions: p.versions.filter(isCompleteVersion).map((v) => ({
        id: v.id,
        collectionCount: v.collectionCount,
        model: v.model,
        coreDNA: v.coreDNA,
        looks: v.looks as unknown as CollectionLook[],
        lookImages: v.lookImages,
        createdAt: v.createdAt.toISOString(),
      })),
    },
  };
}

/** The admin's saved collections, newest first (the "History" tab). */
export async function listCollectionsAction(): Promise<ActionResult<CollectionSummary[]>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const rows = await db.collectionProposal.findMany({
    where: { ownerId: admin.id },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { id: true, name: true, sourceImages: true, updatedAt: true, versions: { orderBy: { order: "desc" }, select: { collectionCount: true, lookImages: true } } },
  });
  return {
    success: true,
    data: rows.map((r) => {
      const complete = r.versions.filter(isCompleteVersion);
      return {
        id: r.id,
        name: r.name,
        thumbnail: r.sourceImages[0] ?? null,
        latest: complete[0]?.lookImages[0] ?? null,
        versions: complete.length,
        updatedAt: r.updatedAt.toISOString(),
      };
    }),
  };
}

export async function deleteCollectionAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const p = await db.collectionProposal.findUnique({ where: { id }, select: { ownerId: true } });
  if (!p || p.ownerId !== admin.id) return { success: false, error: "Collection not found." };
  await db.collectionProposal.delete({ where: { id } });
  return { success: true, data: undefined };
}
