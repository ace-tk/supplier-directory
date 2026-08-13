// Backend prompt builder for "Create Product Description" on the Product
// module's Add/Edit form. Mirrors lib/ai/prompts/content-generation.ts —
// same shared guardrails, same runChatCompletion engine — just a
// product-fields-shaped input instead of a content-studio one. Output is
// plain text (Product Description is a plain string field, not Tiptap
// HTML), so no HTML formatting rules here.

import { buildSystemPreamble } from "./shared";
import type { GenerateProductDescriptionInput } from "@/lib/validations/product-ai";

export const PRODUCT_DESCRIPTION_MAX_TOKENS = 300;

function formatField(label: string, value: string | number | undefined | null): string | null {
  if (value === undefined || value === null || value === "") return null;
  return `${label}: ${value}`;
}

export function buildProductDescriptionPrompt(input: GenerateProductDescriptionInput): { system: string; user: string } {
  const system = buildSystemPreamble([
    "Task: write a single, concise B2B wholesale product description (2-4 sentences), plain text only — no HTML, no markdown, no headings, no bullet list markup.",
    "Base it ONLY on the structured product fields you're given below. Do not invent fabric, material, features, certifications, or claims that weren't supplied.",
    "If a field is missing, simply don't mention that aspect — never guess a plausible-sounding value for it.",
    "Write for a B2B buyer evaluating this product for bulk/wholesale purchase.",
  ]);

  const fields = [
    formatField("Product name", input.productName),
    formatField("Category", input.category),
    formatField("Brand", input.brandName),
    formatField("Color", input.color),
    input.sizes.length ? `Sizes available: ${input.sizes.join(", ")}` : null,
    formatField("Gender/fit segment", input.gender),
    formatField("Stock quantity", input.quantity),
    formatField("GST rate", input.gstPercent !== undefined ? `${input.gstPercent}%` : undefined),
    formatField("Price before GST", input.priceBeforeGst !== undefined ? `${input.priceBeforeGst} ${input.currency ?? ""}`.trim() : undefined),
  ].filter((line): line is string => line !== null);

  const existingNote = input.existingDescription?.trim()
    ? `\n\nThe user already has a draft description — improve/rewrite it rather than ignoring it, keeping every fact it states: "${input.existingDescription.trim()}"`
    : "";

  const user = `Write a product description from these fields:\n${fields.join("\n")}${existingNote}`;

  return { system, user };
}
