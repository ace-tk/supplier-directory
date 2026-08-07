// Reusable AI editing action definitions — server-safe (no React/icon
// imports) so this module can be imported directly by API route handlers
// without pulling client-only UI code into the server bundle. Icon/label
// metadata for the toolbar itself lives in
// components/content/AIAssistantToolbar.tsx, which imports the action ids
// from here rather than the other way around, to avoid circular imports.

export const AI_EDIT_ACTIONS = [
  "REWRITE",
  "IMPROVE",
  "EXPAND",
  "SHORTEN",
  "TONE_PROFESSIONAL",
  "TONE_MARKETING",
  "TONE_LUXURY",
  "TONE_TECHNICAL",
  "TRANSLATE",
  "FIX_GRAMMAR",
  "SIMPLIFY",
  "SEO_OPTIMIZE",
] as const;

export type AIEditAction = (typeof AI_EDIT_ACTIONS)[number];

export const AI_EDIT_ACTION_LABELS: Record<AIEditAction, string> = {
  REWRITE: "Rewrite",
  IMPROVE: "Improve Writing",
  EXPAND: "Expand",
  SHORTEN: "Shorten",
  TONE_PROFESSIONAL: "Professional Tone",
  TONE_MARKETING: "Marketing Tone",
  TONE_LUXURY: "Luxury Tone",
  TONE_TECHNICAL: "Technical Tone",
  TRANSLATE: "Translate",
  FIX_GRAMMAR: "Fix Grammar",
  SIMPLIFY: "Simplify",
  SEO_OPTIMIZE: "SEO Optimize",
};

const ACTION_INSTRUCTIONS: Record<AIEditAction, string> = {
  REWRITE: "Rewrite the content while preserving its original meaning.",
  IMPROVE: "Improve clarity, grammar, readability, and professionalism.",
  EXPAND: "Expand the content with additional useful, specific information while preserving its existing structure.",
  SHORTEN: "Make the content more concise without losing key information.",
  TONE_PROFESSIONAL: "Rewrite using a professional business tone.",
  TONE_MARKETING: "Rewrite using persuasive marketing language.",
  TONE_LUXURY: "Rewrite for premium, luxury brands.",
  TONE_TECHNICAL: "Rewrite using technical terminology suitable for industry professionals.",
  TRANSLATE: "Translate the content into the requested target language while preserving formatting.",
  FIX_GRAMMAR: "Correct grammar and spelling without changing the meaning.",
  SIMPLIFY: "Rewrite using simpler, plainer language.",
  SEO_OPTIMIZE: "Optimize headings, keyword usage, and readability for SEO while preserving the existing structure.",
};

// EXPAND/TRANSLATE/SEO get a slightly higher ceiling since their output can
// legitimately be longer than the input; every other action edits in place
// and shouldn't need much more room than the source content itself.
const ACTION_MAX_TOKENS: Record<AIEditAction, number> = {
  REWRITE: 1400,
  IMPROVE: 1400,
  EXPAND: 2000,
  SHORTEN: 1000,
  TONE_PROFESSIONAL: 1400,
  TONE_MARKETING: 1400,
  TONE_LUXURY: 1400,
  TONE_TECHNICAL: 1400,
  TRANSLATE: 1800,
  FIX_GRAMMAR: 1400,
  SIMPLIFY: 1400,
  SEO_OPTIMIZE: 1800,
};

export function maxTokensForAction(action: AIEditAction): number {
  return ACTION_MAX_TOKENS[action];
}

export interface BuildContentEditPromptOptions {
  /** Human-readable target language label, e.g. "French" — only used for TRANSLATE. */
  targetLanguage?: string;
}

export function buildContentEditPrompt(
  action: AIEditAction,
  html: string,
  opts: BuildContentEditPromptOptions = {}
): { system: string; user: string } {
  const instruction =
    action === "TRANSLATE"
      ? `Translate the content into ${opts.targetLanguage ?? "English"} while preserving formatting.`
      : ACTION_INSTRUCTIONS[action];

  const system = [
    "You are an expert B2B wholesale marketplace editor for SupplyBase, editing existing rich-text content inside a WYSIWYG editor.",
    instruction,
    "The input is an HTML fragment produced by that editor. Preserve as much of the existing HTML structure as possible — headings, tables, lists, and formatting — do not flatten everything into plain <p> tags unless the instruction is specifically to simplify.",
    "Preserve every existing <img> src, <a> href, and any embedded media, table, or asset reference exactly as given unless the instruction explicitly asks you to change that reference — only edit the surrounding text and structure.",
    "Output ONLY the updated HTML fragment. Do NOT include <html>, <head>, <body>, markdown syntax, or code fences.",
  ].join(" ");

  return { system, user: html };
}
