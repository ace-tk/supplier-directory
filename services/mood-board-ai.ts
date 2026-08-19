"use server";

// Real AI features for the Mood Board — every call goes through the one
// shared engine (lib/ai/openai-client.ts runChatCompletion), never a second
// OpenAI integration. If OPENAI_API_KEY isn't configured, callers surface
// AIConfigError's honest message rather than a fake response.

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { runChatCompletion, AIConfigError } from "@/lib/ai/openai-client";
import type { MoodBoardItemContent } from "@/types/mood-board";

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

type BoardContextResult = { error: string } | { summary: string };

async function requireBoardContext(boardId: string): Promise<BoardContextResult> {
  const user = await getUser();
  if (!user) return { error: "You must be signed in." };

  const board = await db.moodBoard.findUnique({
    where: { id: boardId },
    include: { items: true },
  });
  if (!board || board.ownerId !== user.id) return { error: "Board not found." };

  const materials = new Set<string>();
  const notes: string[] = [];
  for (const item of board.items) {
    const content = item.content as MoodBoardItemContent | null;
    if (!content) continue;
    if (content.kind === "material") materials.add(content.name);
    if (content.kind === "note") notes.push([content.title, ...content.bullets].filter(Boolean).join("; "));
    if (content.kind === "annotation") notes.push(`${content.title}: ${content.description}`);
  }

  const summary = [
    `Board name: ${board.name}`,
    board.palette.length ? `Color palette: ${board.palette.join(", ")}` : "Color palette: none set yet",
    materials.size ? `Materials referenced: ${[...materials].join(", ")}` : "Materials referenced: none yet",
    notes.length ? `Notes/annotations: ${notes.join(" | ")}` : "Notes/annotations: none yet",
    `Total canvas items: ${board.items.length}`,
  ].join("\n");

  return { summary };
}

function withAiErrorHandling<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  return fn()
    .then((data) => ({ success: true as const, data }))
    .catch((err) => ({ success: false as const, error: err instanceof AIConfigError ? err.message : err instanceof Error ? err.message : "AI request failed." }));
}

/** Bottom AI bar / "Ask AI" — free-text question, answered with real board
 * context, plain text response. */
export async function askMoodBoardAiAction(boardId: string, question: string): Promise<ActionResult<string>> {
  const ctx = await requireBoardContext(boardId);
  if ("error" in ctx) return { success: false, error: ctx.error };
  if (!question.trim()) return { success: false, error: "Ask something first." };

  return withAiErrorHandling(() =>
    runChatCompletion({
      system:
        "You are a design assistant embedded in a B2B apparel sourcing mood board tool called SupplyBase. Answer concisely (2-4 sentences), in a practical, professional tone suited to fashion/textile design and manufacturing.",
      user: `Current board context:\n${ctx.summary}\n\nUser question: ${question}`,
      maxTokens: 300,
    })
  );
}

export interface AiSuggestion {
  category: string;
  suggestion: string;
}

/** Top "AI Suggest" — structured, board-aware suggestions the user reviews
 * before anything changes (Apply/Dismiss per suggestion, never auto-applied). */
export async function suggestForBoardAction(boardId: string): Promise<ActionResult<AiSuggestion[]>> {
  const ctx = await requireBoardContext(boardId);
  if ("error" in ctx) return { success: false, error: ctx.error };

  return withAiErrorHandling(async () => {
    const text = await runChatCompletion({
      system:
        'You are a design assistant for a B2B apparel mood board tool. Given the board context, return ONLY a JSON array (no prose, no markdown fences) of 3-5 objects: [{"category":"Color"|"Fabric"|"Style"|"Silhouette"|"Print/Embroidery"|"Layout","suggestion":"one practical sentence"}]. Be specific to what is actually on the board.',
      user: ctx.summary,
      maxTokens: 500,
    });
    const jsonText = text.trim().replace(/^```json?\s*/i, "").replace(/```$/, "");
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) throw new Error("Unexpected AI response format.");
    return parsed
      .filter((p): p is AiSuggestion => typeof p?.category === "string" && typeof p?.suggestion === "string")
      .slice(0, 5);
  });
}

export type RemixTarget = "COLOR_PALETTE" | "LAYOUT" | "MATERIAL_DIRECTION" | "STYLE_DIRECTION";

export interface RemixProposal {
  target: RemixTarget;
  summary: string;
  palette?: string[];
  layoutPreset?: "two-column" | "three-image" | "editorial" | "product-centered";
}

const HEX_RE = /^#[0-9a-f]{6}$/i;

/** AI Remix — never overwrites the board directly. Returns a structured
 * proposal the caller previews, then explicitly applies. LAYOUT remix
 * proposes one of the real, working layout presets (see
 * lib/mood-board-layouts.ts) rather than free-form AI-driven repositioning
 * — Apply reuses the exact same real reflow function the manual Layout
 * panel uses. */
export async function remixBoardAction(boardId: string, target: RemixTarget): Promise<ActionResult<RemixProposal>> {
  const ctx = await requireBoardContext(boardId);
  if ("error" in ctx) return { success: false, error: ctx.error };

  return withAiErrorHandling(async () => {
    if (target === "COLOR_PALETTE") {
      const text = await runChatCompletion({
        system:
          'Propose a refined 5-color palette for this apparel mood board. Return ONLY JSON (no prose): {"summary":"one sentence describing the direction","palette":["#rrggbb", "#rrggbb", "#rrggbb", "#rrggbb", "#rrggbb"]}.',
        user: ctx.summary,
        maxTokens: 250,
      });
      const parsed = JSON.parse(text.trim().replace(/^```json?\s*/i, "").replace(/```$/, ""));
      const palette = Array.isArray(parsed.palette) ? parsed.palette.filter((h: unknown) => typeof h === "string" && HEX_RE.test(h)) : [];
      if (palette.length === 0) throw new Error("The AI didn't return a usable palette. Try again.");
      return { target, summary: String(parsed.summary ?? "A refined palette direction."), palette };
    }

    if (target === "LAYOUT") {
      const text = await runChatCompletion({
        system:
          'Pick the single best-fitting composition for this board from exactly these options: "two-column", "three-image", "editorial", "product-centered". Return ONLY JSON: {"summary":"one sentence why","layoutPreset":"<one of the four options>"}.',
        user: ctx.summary,
        maxTokens: 150,
      });
      const parsed = JSON.parse(text.trim().replace(/^```json?\s*/i, "").replace(/```$/, ""));
      const valid = ["two-column", "three-image", "editorial", "product-centered"];
      const preset = valid.includes(parsed.layoutPreset) ? parsed.layoutPreset : "editorial";
      return { target, summary: String(parsed.summary ?? "A suggested composition."), layoutPreset: preset };
    }

    // MATERIAL_DIRECTION / STYLE_DIRECTION — a text proposal, applied as a
    // real NOTE item on the board (see mood-board-remix apply handler).
    const label = target === "MATERIAL_DIRECTION" ? "material direction" : "style direction";
    const text = await runChatCompletion({
      system: `Propose a ${label} for this apparel mood board in 2-3 sentences, practical and specific. Return ONLY JSON: {"summary":"the proposal text"}.`,
      user: ctx.summary,
      maxTokens: 200,
    });
    const parsed = JSON.parse(text.trim().replace(/^```json?\s*/i, "").replace(/```$/, ""));
    return { target, summary: String(parsed.summary ?? "") };
  });
}
