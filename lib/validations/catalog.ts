import { z } from "zod";

export const catalogRowInputSchema = z.object({
  category: z.string().optional(),
  productName: z.string().min(1, "Product name is required").default("Untitled Product"),
  sku: z.string().optional(),
  description: z.string().optional(),
  quantity: z.coerce.number().int().min(0).default(0),
  sizes: z.array(z.string()).default([]),
  color: z.string().optional(),
  moq: z.coerce.number().int().min(0).optional(),
  priceBeforeGst: z.coerce.number().min(0).default(0),
  priceAfterGst: z.coerce.number().min(0).default(0),
  currency: z.string().default("INR"),
  shippingCost: z.coerce.number().min(0).default(0),
  miscCost: z.coerce.number().min(0).default(0),
  leadTime: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "DRAFT"]).default("ACTIVE"),
  notes: z.string().optional(),
});

export type CatalogRowInput = z.infer<typeof catalogRowInputSchema>;
