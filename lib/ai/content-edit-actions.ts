// Reusable AI editing action IDs/labels — server-safe (no React/icon
// imports) so this module can be imported directly by API route handlers
// AND by client components (AIAssistantToolbar) without pulling
// client-only UI code into the server bundle or server-only code into the
// client bundle. The actual prompt construction for these actions lives in
// lib/ai/prompts/content-editing.ts (server-only entry point: only the
// /api/content/ai-edit route imports it), keeping this file's concern
// strictly to "what actions exist and what are they called."

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
  "SUMMARIZE",
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
  SUMMARIZE: "AI Summarize",
};
