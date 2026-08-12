// Backend prompt builder for AI Content Studio generation
// (app/api/content/generate/route.ts). The frontend (ContentGenerationForm)
// only ever sends structured fields — title/contentType/language/tone/
// audience/prompt — never a pre-built prompt string; this module is where
// those structured inputs become the actual OpenAI instructions.

import { buildSystemPreamble, HTML_OUTPUT_FORMAT_RULES } from "./shared";
import { CONTENT_TYPE_LABELS, CONTENT_LANGUAGE_LABELS, CONTENT_TONE_LABELS, CONTENT_AUDIENCE_LABELS } from "@/lib/content-ui";
import type { ContentType, ContentLanguage, ContentTone, ContentAudience } from "@/types/content";

export interface ContentGenerationInput {
  title: string;
  contentType: ContentType;
  language: ContentLanguage;
  tone: ContentTone;
  audience: ContentAudience;
  prompt: string;
}

/** A sensible ceiling for freshly-generated content — bounded well below
 * an expensive request, but roomy enough for the longer content types
 * (Blog, Newsletter) without needing per-content-type tuning. */
export const GENERATION_MAX_TOKENS = 1600;

export function buildContentGenerationPrompt(input: ContentGenerationInput): { system: string; user: string } {
  const system = buildSystemPreamble([
    `Content type: ${CONTENT_TYPE_LABELS[input.contentType]}.`,
    `Tone: ${CONTENT_TONE_LABELS[input.tone]}.`,
    `Target audience: ${CONTENT_AUDIENCE_LABELS[input.audience]}.`,
    `Language: write the entire response in ${CONTENT_LANGUAGE_LABELS[input.language]}.`,
    "Keep the length appropriate to the content type — concise for a product description or social caption, longer for a blog or newsletter.",
    HTML_OUTPUT_FORMAT_RULES,
  ]);

  const user =
    `Title: ${input.title}\n\n` +
    `The user's own description of what to write — treat everything stated here as verified fact and the only factual basis for the content. ` +
    `Do not add product or business details beyond what's stated:\n${input.prompt}`;

  return { system, user };
}
