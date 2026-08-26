"use server";

// Design Studio — Repeat Print Maker. Admin-only. Two real AI calls per
// generation (both through the one shared client in lib/ai/openai-client.ts,
// never a second OpenAI integration): a vision read of the uploaded
// reference photos, then a text-to-image call that turns that description
// into one seamless square tile. Nothing here fakes generation — if
// OPENAI_API_KEY isn't configured, AIConfigError's honest message surfaces
// instead of a placeholder image.

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { runVisionChatCompletion, generateImage, AIConfigError } from "@/lib/ai/openai-client";
import { validateImage, extractDataUrlMeta } from "@/lib/file-validation";

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

export interface RepeatPrintDesignSummary {
  id: string;
  name: string;
  tileImage: string;
  repeatCount: number;
  ownerName: string;
  updatedAt: string;
}

export interface RepeatPrintDesignDetail extends RepeatPrintDesignSummary {
  referenceImages: string[];
}

/** Stage 1 of the real EXTRACTING → GENERATING → TILING pipeline. Split
 * into its own action (rather than one call that does both AI steps
 * internally) so the client observes two genuinely distinct network round
 * trips with real start/end boundaries — no fabricated progress percentage
 * standing in for work that isn't actually happening in stages. */
export async function analyzeReferencePrintAction(referenceImages: string[]): Promise<ActionResult<string>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  if (referenceImages.length === 0) return { success: false, error: "Upload at least one reference image." };
  if (referenceImages.length > 4) return { success: false, error: "Upload up to 4 reference images." };

  for (const dataUrl of referenceImages) {
    const { mimeType, sizeBytes } = extractDataUrlMeta(dataUrl);
    const check = validateImage(mimeType, sizeBytes);
    if (!check.valid) return { success: false, error: check.error! };
  }

  return withAiErrorHandling(() =>
    runVisionChatCompletion({
      system:
        "You are a textile print analyst. Look at the reference photo(s) of a garment, drawing, or artwork and describe ONLY the print/pattern: its motifs, subject matter, color palette (name the actual colors you see), density/scale of the repeat, and art style (e.g. hand-painted watercolor, vector flat, engraved line art). 3-5 sentences, concrete and specific, no commentary about the garment itself (cut, fit, fabric weight).",
      user: "Describe the print pattern shown in these reference images so it can be regenerated as a new seamless tile.",
      images: referenceImages,
      maxTokens: 300,
    })
  );
}

/** Stage 2 — turns the real description from stage 1 into a real generated
 * image. Kept as a separate action for the same reason as stage 1 above. */
export async function generateRepeatPrintTileAction(description: string): Promise<ActionResult<string>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  if (!description.trim()) return { success: false, error: "Nothing to generate from." };

  return withAiErrorHandling(() =>
    generateImage({
      prompt: `A seamless, edge-to-edge tileable repeating surface pattern, flat top-down view (not on a garment, no folds, no shadows, no mockup). ${description} The motifs must tile continuously with no visible seam or border when repeated edge-to-edge in all directions.`,
      size: "1024x1024",
    })
  );
}

/** Explicit Save — creates one new RepeatPrintDesign (+ its reference-image
 * rows) as a single Prisma nested write, the same atomic pattern used by
 * signup's User+Freelancer create. When `id` is passed, only the display
 * settings (name/repeatCount) are updated in place rather than regenerating
 * or re-uploading anything. */
export async function saveRepeatPrintDesignAction(input: {
  id?: string;
  name: string;
  tileImage: string;
  repeatCount: number;
  referenceImages: string[];
}): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const name = input.name.trim() || "Untitled Print";
  const repeatCount = Math.min(8, Math.max(2, Math.round(input.repeatCount)));

  if (input.id) {
    const existing = await db.repeatPrintDesign.findUnique({ where: { id: input.id }, select: { id: true } });
    if (!existing) return { success: false, error: "Design not found." };
    const updated = await db.repeatPrintDesign.update({
      where: { id: input.id },
      data: { name, repeatCount },
      select: { id: true },
    });
    return { success: true, data: updated };
  }

  if (!input.tileImage) return { success: false, error: "Generate a tile before saving." };

  const created = await db.repeatPrintDesign.create({
    data: {
      ownerId: admin.id,
      name,
      tileImage: input.tileImage,
      repeatCount,
      referenceImages: {
        create: input.referenceImages.map((dataUrl, order) => ({ dataUrl, order })),
      },
    },
    select: { id: true },
  });

  return { success: true, data: created };
}

/** Shared internal-tool list, not siloed per admin — any admin can see and
 * reopen a design a teammate saved, same as Catalog/Product entries. */
export async function getRecentRepeatPrintDesignsAction(): Promise<ActionResult<RepeatPrintDesignSummary[]>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const rows = await db.repeatPrintDesign.findMany({
    orderBy: { updatedAt: "desc" },
    take: 24,
    include: { owner: { select: { name: true } } },
  });

  return {
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      name: r.name,
      tileImage: r.tileImage,
      repeatCount: r.repeatCount,
      ownerName: r.owner.name,
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}

export async function getRepeatPrintDesignAction(id: string): Promise<ActionResult<RepeatPrintDesignDetail>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const design = await db.repeatPrintDesign.findUnique({
    where: { id },
    include: { owner: { select: { name: true } }, referenceImages: { orderBy: { order: "asc" } } },
  });
  if (!design) return { success: false, error: "Design not found." };

  return {
    success: true,
    data: {
      id: design.id,
      name: design.name,
      tileImage: design.tileImage,
      repeatCount: design.repeatCount,
      ownerName: design.owner.name,
      updatedAt: design.updatedAt.toISOString(),
      referenceImages: design.referenceImages.map((r) => r.dataUrl),
    },
  };
}

export async function deleteRepeatPrintDesignAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const existing = await db.repeatPrintDesign.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { success: false, error: "Design not found." };

  await db.repeatPrintDesign.delete({ where: { id } });
  return { success: true, data: undefined };
}
