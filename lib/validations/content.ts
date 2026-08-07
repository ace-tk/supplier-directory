import { z } from "zod";
import { AI_EDIT_ACTIONS } from "@/lib/ai/content-edit-actions";

export const contentAttachmentSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number(),
  dataUrl: z.string().min(1),
});

const contentTypeEnum = z.enum([
  "PRODUCT_DESCRIPTION",
  "COMPANY_PROFILE",
  "EMAIL",
  "NEWSLETTER",
  "LINKEDIN_POST",
  "INSTAGRAM_CAPTION",
  "WEBSITE_CONTENT",
  "BLOG",
  "CATALOG_DESCRIPTION",
  "OTHER",
]);

const contentLanguageEnum = z.enum(["ENGLISH", "FRENCH", "GERMAN"]);

const contentToneEnum = z.enum(["PROFESSIONAL", "FRIENDLY", "LUXURY", "TECHNICAL", "MARKETING"]);

const contentAudienceEnum = z.enum(["BUYERS", "SUPPLIERS", "EXPORTERS", "RETAILERS", "MANUFACTURERS"]);

export const saveContentSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2, "Title is required"),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  featuredImageUrl: z.string().optional(),
  bodyHtml: z.string().default(""),
  attachments: z.array(contentAttachmentSchema).default([]),
  prompt: z.string().optional(),
  contentType: contentTypeEnum.optional(),
  language: contentLanguageEnum.optional(),
  tone: contentToneEnum.optional(),
  audience: contentAudienceEnum.optional(),
  isTemplate: z.boolean().optional(),
});

export type SaveContentInput = z.infer<typeof saveContentSchema>;

// Input to the AI generation endpoint — kept separate from saveContentSchema
// since generation doesn't touch the DB and has its own required fields
// (prompt is mandatory here; it's optional on save so older/manual content
// still validates).
export const generateContentSchema = z.object({
  title: z.string().min(2, "Title is required"),
  contentType: contentTypeEnum,
  language: contentLanguageEnum,
  tone: contentToneEnum,
  audience: contentAudienceEnum,
  prompt: z.string().min(10, "Describe what you'd like generated (at least 10 characters)"),
});

export type GenerateContentInput = z.infer<typeof generateContentSchema>;

// Input to the AI editing endpoint (rewrite/tone/translate/etc. actions run
// against content already open in the editor). `html` is capped well above
// any realistic editor payload so a single request can't be used to run up
// an unbounded OpenAI bill.
export const aiEditContentSchema = z.object({
  action: z.enum(AI_EDIT_ACTIONS),
  html: z.string().min(1, "There's no content to edit yet.").max(60000, "This content is too long for AI editing — try shortening it first."),
  targetLanguage: contentLanguageEnum.optional(),
});

export type AIEditContentInput = z.infer<typeof aiEditContentSchema>;
