"use server";

// Design Studio — Pattern to Garment. Admin-only, same as every other AI
// Garment Studio tool. Every AI call goes through the one shared engine
// (lib/ai/openai-client.ts) — no second OpenAI integration.
//
// Two AI steps, same analyze-then-generate shape as Garment Back Design:
//   1. a vision read of the labelled pattern pieces → short "assembly
//      notes" (how the pieces join), used as textual grounding;
//   2. an image-conditioned render of one view (front / back / side),
//      with every pattern piece passed as a reference image. Back and side
//      also get the generated FRONT view as the first reference, so all
//      three views stay the same garment.
//
// Pieces arrive as FormData (real Files, not data-URL strings — large
// data URLs as Server Action arguments hit a Flight serialization limit,
// see EditImageParams in lib/ai/openai-client.ts). Nothing is persisted
// yet: results are returned to the client only.

import { getUser } from "@/lib/session";
import { runVisionChatCompletion, editImage, AIConfigError } from "@/lib/ai/openai-client";
import { validateImage } from "@/lib/file-validation";

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

export type PatternGarmentView = "front" | "back" | "side";

interface PieceMeta {
  name: string;
  cutCount: number;
  measurements: string;
}

interface DesignDetails {
  garmentType: string;
  fabric: string;
  notes: string;
}

/** gpt-image-1 accepts up to 16 input images; back/side add the front view. */
const MAX_PIECES = 10;

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

function text(formData: FormData, key: string, max: number): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Reads and validates the pieces + their labels from the submitted form. */
function readPieces(formData: FormData): { files: File[]; metas: PieceMeta[] } | { error: string } {
  const files = formData.getAll("piece").filter((v): v is File => v instanceof File);
  if (files.length === 0) return { error: "Add at least one pattern piece." };
  if (files.length > MAX_PIECES) return { error: `Add at most ${MAX_PIECES} pattern pieces.` };

  let raw: unknown;
  try {
    raw = JSON.parse(text(formData, "meta", 20_000) || "[]");
  } catch {
    return { error: "Invalid pattern piece details." };
  }
  if (!Array.isArray(raw) || raw.length !== files.length) return { error: "Invalid pattern piece details." };

  const metas: PieceMeta[] = raw.map((m, i) => {
    const r = (m ?? {}) as Record<string, unknown>;
    return {
      name: (typeof r.name === "string" && r.name.trim() ? r.name.trim() : `Piece ${i + 1}`).slice(0, 60),
      cutCount: Math.min(4, Math.max(1, Math.round(Number(r.cutCount) || 1))),
      measurements: typeof r.measurements === "string" ? r.measurements.trim().slice(0, 300) : "",
    };
  });

  for (const f of files) {
    const check = validateImage(f.type, f.size);
    if (!check.valid) return { error: check.error! };
  }
  return { files, metas };
}

function readDetails(formData: FormData): DesignDetails {
  return {
    garmentType: text(formData, "garmentType", 80),
    fabric: text(formData, "fabric", 200),
    notes: text(formData, "notes", 600),
  };
}

function describePieces(metas: PieceMeta[], firstImageIndex: number): string {
  return metas
    .map((m, i) => {
      const parts = [`Image ${i + firstImageIndex}: pattern piece "${m.name}", cut ${m.cutCount}`];
      if (m.measurements) parts.push(`measurements: ${m.measurements}`);
      return parts.join(", ");
    })
    .join(". ");
}

const ANALYSIS_SYSTEM_PROMPT = `You are an expert garment patternmaker. You will see flat sewing pattern pieces (paper templates or cut fabric), each labelled by the designer. Work out how they assemble into one finished garment and write concise, factual assembly notes covering: garment type, silhouette and length, neckline/collar/lapels, sleeves or sleeveless armholes, closure (e.g. centre-front buttons and how many if marked), darts, princess or panel seams, pockets or welts, hem shape, and anything else the pieces clearly define. Only describe what the pieces support — do not invent details. Plain text, no preamble, no markdown, under 120 words.`;

/** Step 1 — a real vision read of the labelled pieces. Its output becomes
 * explicit grounding text for every view in step 2. */
export async function analyzePatternPiecesAction(formData: FormData): Promise<ActionResult<string>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const pieces = readPieces(formData);
  if ("error" in pieces) return { success: false, error: pieces.error };
  const details = readDetails(formData);

  return withAiErrorHandling(async () => {
    const images = await Promise.all(pieces.files.map(blobToDataUrl));
    const userText = [
      `These are ${pieces.files.length} pattern pieces for one garment.`,
      describePieces(pieces.metas, 1) + ".",
      details.garmentType ? `The designer says the garment is: ${details.garmentType}.` : "",
      "Write the assembly notes.",
    ]
      .filter(Boolean)
      .join(" ");
    const notes = await runVisionChatCompletion({
      system: ANALYSIS_SYSTEM_PROMPT,
      user: userText,
      images,
      model: "gpt-4o",
      maxTokens: 300,
    });
    return notes.trim();
  });
}

const BASE_PROMPT = [
  "Create a realistic, professional fashion product photograph of the finished garment that results from sewing together the provided flat pattern pieces.",
  "The pattern pieces are sewing templates, not the final garment: assemble them mentally — join matching seams, sew the darts, close the garment along its closure, and attach collar, sleeves and pockets exactly as the pieces indicate.",
  "Preserve the original pattern structure and design: the silhouette, proportions, length, neckline and collar shape, armholes or sleeves, dart and seam placement, closures and hem shape must all follow the pieces.",
  "Do not add design elements the pieces do not support. Do not change the garment type.",
  "Present it as ghost-mannequin (invisible mannequin) product photography: no human model, full garment visible and centred, plain light neutral studio background, soft even lighting, realistic fabric drape and clean stitching.",
  "Do not include any text, labels, measurements, arrows, grid lines or pattern markings in the image.",
].join(" ");

const VIEW_PROMPT: Record<PatternGarmentView, string> = {
  front: "Show the FRONT view of the garment.",
  back: "The FIRST reference image is the already-generated front view of this exact garment. Show the BACK view of that same garment — identical fabric, colour, silhouette, length and construction — with back seams, darts and closures taken from the back pattern pieces. Match the front image's presentation, background and lighting.",
  side: "The FIRST reference image is the already-generated front view of this exact garment. Show a SIDE (profile) view of that same garment, turned 90 degrees — identical fabric, colour, silhouette, length and construction, with side seams and shaping consistent with the pattern pieces. Match the front image's presentation, background and lighting.",
};

function buildViewPrompt(view: PatternGarmentView, metas: PieceMeta[], analysis: string, details: DesignDetails): string {
  const firstPieceImage = view === "front" ? 1 : 2;
  return [
    BASE_PROMPT,
    VIEW_PROMPT[view],
    `Reference images: ${describePieces(metas, firstPieceImage)}.`,
    analysis ? `Assembly notes: ${analysis}` : "",
    details.garmentType ? `Garment type: ${details.garmentType}.` : "",
    details.fabric
      ? `Fabric and colour: ${details.fabric}.`
      : "If the pieces are cut fabric, use that fabric's colour and texture; if they are paper or line drawings, use a plain solid mid-tone fabric.",
    details.notes ? `Designer notes (must not change the pattern structure): ${details.notes}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Step 2 — renders one view. Front conditions on the pieces only; back and
 * side put the generated front view first so every view is the same garment. */
export async function generatePatternGarmentViewAction(formData: FormData): Promise<ActionResult<string>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const view = formData.get("view");
  if (view !== "front" && view !== "back" && view !== "side") return { success: false, error: "Unknown view." };

  const pieces = readPieces(formData);
  if ("error" in pieces) return { success: false, error: pieces.error };
  const details = readDetails(formData);
  const analysis = text(formData, "analysis", 2000);

  let references: Blob[] = pieces.files;
  if (view !== "front") {
    const front = formData.get("frontView");
    if (!(front instanceof File)) return { success: false, error: "Generate the front view first." };
    const check = validateImage(front.type, front.size);
    if (!check.valid) return { success: false, error: check.error! };
    references = [front, ...pieces.files];
  }

  return withAiErrorHandling(() =>
    editImage({
      image: references,
      prompt: buildViewPrompt(view, pieces.metas, analysis, details),
      size: "1024x1536",
    })
  );
}
