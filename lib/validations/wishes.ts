import { z } from "zod";

export const wishImageInputSchema = z.object({
  dataUrl: z.string().min(1),
});

/** Only `name` is required to persist a draft — a buyer should be able to
 * jot down an idea and come back later. All the fields marked required on
 * the form (category/description/≥1 image) are enforced server-side in
 * submitWishAction instead, the standard "draft vs. required-to-submit"
 * split, not at draft-save time. */
export const saveWishDraftSchema = z.object({
  id: z.string().optional(), // present => update an existing wish the caller owns
  name: z.string().min(1, "Wish name is required"),
  category: z.string().optional().default(""),
  description: z.string().optional().default(""),
  images: z.array(wishImageInputSchema).default([]),
  targetQuantity: z.coerce.number().int().min(1).optional(),
  targetMoq: z.coerce.number().int().min(1).optional(),
  targetPrice: z.coerce.number().min(0).optional(),
  currency: z.string().default("INR"),
  material: z.string().optional(),
  colors: z.array(z.string()).default([]),
  sizes: z.array(z.string()).default([]),
  targetLocation: z.string().optional(),
  requiredBy: z.string().optional(), // ISO date string
  notes: z.string().optional(),
  referenceUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

export type SaveWishDraftInput = z.infer<typeof saveWishDraftSchema>;
