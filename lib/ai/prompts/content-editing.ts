// Backend prompt builder for the AI Assistant toolbar's 12 in-place editing
// actions (+ AI Summarize), used by app/api/content/ai-edit/route.ts. The
// frontend (AIAssistantToolbar / runContentAiAction) only ever sends the
// action id + the current HTML + an optional target language — never a
// prompt string; this module turns that structured action into the actual
// OpenAI instructions.

import { buildSystemPreamble, HTML_OUTPUT_FORMAT_RULES } from "./shared";
import type { AIEditAction } from "@/lib/ai/content-edit-actions";

// Each action gets a clearly distinct instruction. Every instruction that
// transforms wording is paired with an explicit "don't change/invent facts"
// clause — the shared hallucination guardrail already covers this globally,
// but repeating it per-action keeps the instruction unambiguous for actions
// (EXPAND, SEO_OPTIMIZE) that could otherwise be read as an invitation to
// add new claims.
const ACTION_INSTRUCTIONS: Record<AIEditAction, string> = {
  REWRITE: "Rewrite the content substantially while preserving its original meaning and every factual claim it contains.",
  IMPROVE: "Improve clarity, flow, readability, and wording. Do not change or add any facts.",
  EXPAND:
    "Add useful explanation or detail, derived only from information already present in the supplied content. " +
    "Do not invent new specifications, features, or business claims just to make it longer.",
  SHORTEN:
    "Reduce the length while preserving essential meaning and every important fact. Cut redundant wording, never factual claims.",
  TONE_PROFESSIONAL: "Rewrite using polished, credible, business-appropriate professional language. Do not change the facts.",
  TONE_MARKETING:
    "Rewrite using persuasive, benefit-oriented marketing language, without fabricating claims, statistics, or guarantees that weren't already present.",
  TONE_LUXURY:
    "Rewrite using refined, premium language appropriate for a luxury brand, without inventing exclusivity, materials, craftsmanship, certifications, or pricing that weren't already present.",
  TONE_TECHNICAL:
    "Rewrite using precise, structured technical terminology suitable for industry professionals. Do not manufacture technical specifications that weren't provided.",
  TRANSLATE:
    "Translate the content faithfully into the requested target language. Preserve meaning, numbers, names, URLs, and HTML structure exactly. " +
    "Do not rewrite, embellish, or add content beyond a faithful translation.",
  FIX_GRAMMAR:
    "Correct grammar, spelling, and punctuation only. Make the minimum necessary changes — do not rewrite the content unnecessarily.",
  SIMPLIFY: "Rewrite using clearer, plainer, more accessible language while preserving meaning and every fact.",
  SEO_OPTIMIZE:
    "Improve headings, structure, readability, and natural keyword usage for SEO. Do not keyword-stuff, and do not invent keywords, " +
    "features, or claims implying product capabilities that weren't already present.",
  SUMMARIZE:
    "Produce a concise summary (3-6 sentences) of the key points, as a short HTML fragment (a heading-free paragraph or short bullet list). " +
    "Do not pad it out — shorter is better if the source is short. Do not introduce any fact not present in the source.",
};

// EXPAND/TRANSLATE/SEO get a slightly higher ceiling since their output can
// legitimately be longer than the input; every other action edits in place
// and shouldn't need much more room than the source content itself.
// Unchanged from the prior implementation — preserved, not loosened.
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
  SUMMARIZE: 500,
};

export function maxTokensForAction(action: AIEditAction): number {
  return ACTION_MAX_TOKENS[action];
}

export interface BuildContentEditPromptOptions {
  /** Human-readable target language label, e.g. "French" — only used for TRANSLATE. */
  targetLanguage?: string;
}

const HTML_PRESERVATION_RULES =
  "The input is an HTML fragment produced by a rich-text editor. Preserve meaningful existing structure whenever the instruction doesn't " +
  "specifically require restructuring — headings, paragraphs, lists, tables, links, and emphasis — do not flatten everything into plain <p> " +
  "tags unless the instruction is specifically to simplify. Never remove an existing <img> or <a> merely because you are rewriting the " +
  "surrounding text — preserve every existing <img> src and <a> href exactly as given unless the instruction explicitly asks you to change " +
  "that reference; only edit the surrounding text and structure.";

export function buildContentEditPrompt(
  action: AIEditAction,
  html: string,
  opts: BuildContentEditPromptOptions = {}
): { system: string; user: string } {
  const instruction =
    action === "TRANSLATE"
      ? `Translate the content into ${opts.targetLanguage ?? "English"} while preserving formatting.`
      : ACTION_INSTRUCTIONS[action];

  const system = buildSystemPreamble([
    "You are editing existing rich-text content inside a WYSIWYG editor.",
    instruction,
    HTML_PRESERVATION_RULES,
    HTML_OUTPUT_FORMAT_RULES,
  ]);

  return { system, user: html };
}
