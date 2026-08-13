import { z } from "zod";

// Structured, real Product fields only — the API route builds the prompt
// from these, never from free-form client-supplied prompt text, so nothing
// the model wasn't actually told about can leak in as an "instruction".
export const generateProductDescriptionSchema = z.object({
  productName: z.string().min(1, "Product name is required to generate a description."),
  category: z.string().optional(),
  brandName: z.string().optional(),
  color: z.string().optional(),
  sizes: z.array(z.string()).default([]),
  gender: z.string().optional(),
  quantity: z.coerce.number().optional(),
  gstPercent: z.coerce.number().optional(),
  priceBeforeGst: z.coerce.number().optional(),
  currency: z.string().optional(),
  existingDescription: z.string().optional(),
});

export type GenerateProductDescriptionInput = z.infer<typeof generateProductDescriptionSchema>;
