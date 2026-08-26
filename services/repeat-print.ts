"use server";

// Design Studio — Repeat Print Maker. Admin-only. A PRESERVATION pipeline,
// not a redraw: the reference artwork's own pixels are cropped, offset-wrapped
// (see lib/repeat-print-canvas.ts) and masked entirely client-side, so the
// only thing AI ever touches is a narrow seam band — everything else in the
// final tile is exactly the source artwork. Vision analysis (still one real
// call, through the same shared client in lib/ai/openai-client.ts) exists
// only to give the seam-repair prompt a short style description so the
// patch matches the surrounding texture; it is never the source of the
// output image. Nothing here fakes generation — if OPENAI_API_KEY isn't
// configured, AIConfigError's honest message surfaces instead of a
// placeholder image.

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { runVisionChatCompletion, editImage, AIConfigError } from "@/lib/ai/openai-client";
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

/** Stage 1 (EXTRACTING) — a short, concrete style description used only as
 * seam-repair guidance in stage 2's prompt, never as a generation source.
 * Split into its own action (rather than one call that does everything
 * internally) so the client observes real, distinct network round trips —
 * no fabricated progress standing in for work that isn't actually
 * happening in stages. */
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
        "You are a textile print analyst helping an inpainting model patch a small seam in an existing piece of artwork without changing its identity. Look at the reference photo(s) and describe, in one tight sentence, ONLY the concrete visual traits an inpainting patch must match: exact motif shapes and relative size, exact color names, line/brush texture, and background tone. Do not describe the garment, do not suggest a new composition, do not use words like 'design' or 'create'.",
      user: "Describe this print's exact visual traits so a seam-repair patch can match them precisely.",
      images: referenceImages,
      maxTokens: 150,
    })
  );
}

/** Stage 2 (GENERATING) — repairs ONLY the masked seam band produced by
 * lib/repeat-print-canvas.ts's offset-wrap; every other pixel in
 * `wrappedImage` is opaque in `mask` and therefore preserved untouched by
 * the model. This — not the stage-1 description — is why the output stays
 * the same artwork instead of becoming a new interpretation of it. */
export async function repairSeamTileAction(wrappedImage: Blob, mask: Blob, styleDescription: string): Promise<ActionResult<string>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  if (!wrappedImage || !mask) return { success: false, error: "Nothing to repair." };

  return withAiErrorHandling(() =>
    editImage({
      image: wrappedImage,
      mask,
      prompt: `Make only the masked seam region continuous and seamless, blending the artwork on either side of it so it reads as one uninterrupted piece. Preserve everything outside the mask exactly as given: do not redraw, restyle, recolor, resize, or reinterpret any of it. Match the surrounding artwork's exact traits: ${styleDescription} Do not add new motifs, do not increase density or detail, do not change the background tone, do not simplify or beautify anything outside the seam.`,
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
