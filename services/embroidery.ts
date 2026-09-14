"use server";

// Design Studio — Print → Embroidery. Admin-only, same as Repeat Print
// Maker and AI Garment Studio. Every AI call goes through the one shared
// engine (lib/ai/openai-client.ts) — no second OpenAI integration.
//
// CONVERT always conditions on the untouched sourceImage (never the prior
// embroidery output), so refining settings and regenerating can't drift
// further from the original artwork with each iteration — the same
// identity-preservation guarantee Garment Studio's masked edits rely on,
// applied here by always restarting from source instead.

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { runVisionChatCompletion, editImage, AIConfigError } from "@/lib/ai/openai-client";
import { validateImage, extractDataUrlMeta } from "@/lib/file-validation";
import {
  type EmbroideryAnalysis,
  type EmbroiderySettings,
  type PlacementId,
  EMBROIDERY_STYLES,
} from "@/lib/embroidery-production";

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

function nearestSupportedSize(width: number, height: number): "1024x1024" | "1024x1536" | "1536x1024" {
  const ratio = width / height;
  if (ratio > 1.15) return "1536x1024";
  if (ratio < 0.87) return "1024x1536";
  return "1024x1024";
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = Buffer.from(await blob.arrayBuffer());
  return `data:${blob.type || "image/png"};base64,${buf.toString("base64")}`;
}

const ANALYSIS_SYSTEM_PROMPT = `You are an embroidery pre-production analyst. Look at the uploaded artwork/logo and assess it for embroidery conversion. Return ONLY a JSON object (no prose, no markdown fences) with this exact shape:
{
  "complexity": "Low" | "Medium" | "High",
  "colors": ["#rrggbb", ...] (up to 8 dominant colors, most prominent first),
  "fineDetails": "Low" | "Moderate" | "High",
  "thinLines": boolean,
  "textDetected": boolean,
  "gradients": boolean,
  "smallElements": boolean,
  "suitability": "Poor" | "Fair" | "Good" | "Excellent",
  "recommendations": [short, practical string, ...] (1-4 items, e.g. "Some fine details may need simplification for embroidery.")
}
Base every field only on what is visible. These are your best estimates, not a certified production analysis.`;

/** Stage 2 — real vision analysis via the same shared client Repeat Print
 * and Garment Studio already use. Every numeric/qualitative field here is
 * an AI estimate, and is labeled as such wherever it's rendered. */
export async function analyzeArtworkAction(artworkDataUrl: string): Promise<ActionResult<EmbroideryAnalysis>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const { mimeType, sizeBytes } = extractDataUrlMeta(artworkDataUrl);
  const check = validateImage(mimeType, sizeBytes);
  if (!check.valid) return { success: false, error: check.error! };

  return withAiErrorHandling(async () => {
    const text = await runVisionChatCompletion({
      system: ANALYSIS_SYSTEM_PROMPT,
      user: "Analyze this artwork for embroidery conversion.",
      images: [artworkDataUrl],
      maxTokens: 400,
    });
    const jsonText = text.trim().replace(/^```json?\s*/i, "").replace(/```$/, "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error("The AI's analysis wasn't readable. Please try again.");
    }
    const p = parsed as Partial<EmbroideryAnalysis>;
    if (!p || typeof p !== "object" || !Array.isArray(p.colors)) {
      throw new Error("The AI's analysis was incomplete. Please try again.");
    }
    const analysis: EmbroideryAnalysis = {
      complexity: p.complexity === "Low" || p.complexity === "High" ? p.complexity : "Medium",
      colors: p.colors.filter((c): c is string => typeof c === "string").slice(0, 8),
      colorCount: p.colors.length,
      fineDetails: p.fineDetails === "Low" || p.fineDetails === "High" ? p.fineDetails : "Moderate",
      thinLines: Boolean(p.thinLines),
      textDetected: Boolean(p.textDetected),
      gradients: Boolean(p.gradients),
      smallElements: Boolean(p.smallElements),
      suitability: (["Poor", "Fair", "Good", "Excellent"] as const).includes(p.suitability as never) ? (p.suitability as EmbroideryAnalysis["suitability"]) : "Fair",
      recommendations: Array.isArray(p.recommendations) ? p.recommendations.filter((r): r is string => typeof r === "string").slice(0, 4) : [],
    };
    return analysis;
  });
}

function buildConversionPrompt(settings: EmbroiderySettings): string {
  const technique = EMBROIDERY_STYLES.find((s) => s.id === settings.style)?.technique ?? "Satin + Fill";
  const detailNote =
    settings.detailLevel < 40
      ? "Simplify fine details and small elements significantly — merge thin lines and tiny shapes into cleaner, bolder forms suitable for embroidery."
      : settings.detailLevel > 80
        ? "Preserve as much fine detail as embroidery realistically allows."
        : "Simplify only the finest details that would be impractical to stitch.";
  const outlineNote = settings.outline ? "Give major shapes a clear stitched outline/edge." : "Do not add a distinct outline stitch around shapes.";
  const fillNote = settings.fill ? "Fill solid areas with visible directional thread texture." : "Keep fills light, avoiding dense thread fill.";
  const colorNote = settings.threadColors.length
    ? `Render using approximately this thread color palette: ${settings.threadColors.join(", ")}.`
    : "";

  return [
    `Convert this artwork into a realistic embroidery concept using a ${technique} technique.`,
    "Preserve the original artwork's composition, logo identity, major shapes, any text, and color relationships as closely as possible — this must remain recognizably the same design, not a new interpretation.",
    "Render it as if machine-embroidered on fabric: visible thread texture, stitched edges, raised fill areas, subtle embroidery depth and realistic thread sheen.",
    detailNote,
    outlineNote,
    fillNote,
    colorNote,
    "Show the design on a plain neutral background, not on a garment.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Stage 3/4 — CONVERT and REGENERATE both call this, always conditioning
 * on the pristine sourceImage (whole-image, no mask — same image-
 * conditioning pattern Garment Studio's GENERATE uses) via the shared
 * editImage engine. No separate AI client, no duplicated logic. */
export async function convertToEmbroideryAction(
  sourceImage: Blob,
  settings: EmbroiderySettings,
  width: number,
  height: number
): Promise<ActionResult<string>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const check = validateImage(sourceImage.type, sourceImage.size);
  if (!check.valid) return { success: false, error: check.error! };

  return withAiErrorHandling(() =>
    editImage({
      image: sourceImage,
      prompt: buildConversionPrompt(settings),
      size: nearestSupportedSize(width, height),
    })
  );
}

/** Export — "Transparent Artwork". A real, separate AI call using
 * gpt-image-1's native background support (see lib/ai/openai-client.ts),
 * not a fabricated background removal. */
export async function exportTransparentArtworkAction(embroideryImage: Blob): Promise<ActionResult<string>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  return withAiErrorHandling(() =>
    editImage({
      image: embroideryImage,
      prompt: "Isolate this exact embroidery design on a transparent background. Do not alter the design, colors, or texture in any way — only remove the surrounding background.",
      size: "1024x1024",
      background: "transparent",
    })
  );
}

export interface EmbroideryDesignSummary {
  id: string;
  name: string;
  sourceImage: string;
  embroideryImage: string | null;
  placement: string;
  isFavorite: boolean;
  garmentType: string | null;
  garmentColor: string | null;
  ownerName: string;
  updatedAt: string;
}

export interface EmbroideryDesignDetail extends EmbroideryDesignSummary {
  analysis: EmbroideryAnalysis | null;
  settings: EmbroiderySettings | null;
  garmentPreview: Record<string, unknown> | null;
}

export async function saveEmbroideryDesignAction(input: {
  id?: string;
  name: string;
  sourceImage: string;
  embroideryImage: string | null;
  analysis: EmbroideryAnalysis | null;
  settings: EmbroiderySettings | null;
  placement: PlacementId;
  /** The full quick-preview transform (scale/position/rotation/chosen
   * garment) — kept as a generic Json-shaped record here so this service
   * doesn't depend on a UI component's type. */
  garmentPreview?: Record<string, unknown> | null;
  isFavorite?: boolean;
  garmentType?: string | null;
  garmentColor?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const name = input.name.trim() || "Untitled Embroidery";
  const data = {
    name,
    sourceImage: input.sourceImage,
    embroideryImage: input.embroideryImage,
    analysis: input.analysis as object | undefined,
    settings: input.settings as object | undefined,
    placement: input.placement,
    ...(input.garmentPreview !== undefined ? { garmentPreview: input.garmentPreview as object | undefined } : {}),
    ...(input.isFavorite !== undefined ? { isFavorite: input.isFavorite } : {}),
    ...(input.garmentType !== undefined ? { garmentType: input.garmentType } : {}),
    ...(input.garmentColor !== undefined ? { garmentColor: input.garmentColor } : {}),
  };

  if (input.id) {
    const existing = await db.embroideryDesign.findUnique({ where: { id: input.id }, select: { id: true } });
    if (!existing) return { success: false, error: "Design not found." };
    const updated = await db.embroideryDesign.update({ where: { id: input.id }, data, select: { id: true } });
    return { success: true, data: updated };
  }

  const created = await db.embroideryDesign.create({ data: { ...data, ownerId: admin.id }, select: { id: true } });
  return { success: true, data: created };
}

export async function getRecentEmbroideryDesignsAction(): Promise<ActionResult<EmbroideryDesignSummary[]>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const rows = await db.embroideryDesign.findMany({
    orderBy: { updatedAt: "desc" },
    take: 24,
    include: { owner: { select: { name: true } } },
  });

  return {
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      name: r.name,
      sourceImage: r.sourceImage,
      embroideryImage: r.embroideryImage,
      placement: r.placement,
      isFavorite: r.isFavorite,
      garmentType: r.garmentType,
      garmentColor: r.garmentColor,
      ownerName: r.owner.name,
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}

/** Used both by the Pattern-Library-style "open" flow and by the AI
 * Garment Studio hand-off (Studio deep-links here with ?embroideryId=).
 * Shared admin-workspace list, same as Repeat Print/Garment Studio — not
 * siloed per admin, so a teammate's saved design can be reopened here too. */
export async function getEmbroideryDesignAction(id: string): Promise<ActionResult<EmbroideryDesignDetail>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const design = await db.embroideryDesign.findUnique({
    where: { id },
    include: { owner: { select: { name: true } } },
  });
  if (!design) return { success: false, error: "Design not found." };

  return {
    success: true,
    data: {
      id: design.id,
      name: design.name,
      sourceImage: design.sourceImage,
      embroideryImage: design.embroideryImage,
      placement: design.placement,
      isFavorite: design.isFavorite,
      garmentType: design.garmentType,
      garmentColor: design.garmentColor,
      ownerName: design.owner.name,
      updatedAt: design.updatedAt.toISOString(),
      analysis: (design.analysis as unknown as EmbroideryAnalysis | null) ?? null,
      settings: (design.settings as unknown as EmbroiderySettings | null) ?? null,
      garmentPreview: (design.garmentPreview as unknown as Record<string, unknown> | null) ?? null,
    },
  };
}

/** Header "Favorite" toggle — same shape as GarmentDesign's isSaved toggle. */
export async function toggleFavoriteEmbroideryDesignAction(id: string): Promise<ActionResult<{ isFavorite: boolean }>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const design = await db.embroideryDesign.findUnique({ where: { id }, select: { isFavorite: true } });
  if (!design) return { success: false, error: "Design not found." };

  const updated = await db.embroideryDesign.update({ where: { id }, data: { isFavorite: !design.isFavorite }, select: { isFavorite: true } });
  return { success: true, data: updated };
}

export async function deleteEmbroideryDesignAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const existing = await db.embroideryDesign.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { success: false, error: "Design not found." };

  await db.embroideryDesign.delete({ where: { id } });
  return { success: true, data: undefined };
}

export { blobToDataUrl };
