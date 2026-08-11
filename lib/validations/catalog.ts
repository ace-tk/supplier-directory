import { z } from "zod";
import { GST_RATE_OPTIONS } from "@/lib/catalog-ui";

export const catalogRowInputSchema = z.object({
  category: z.string().optional(),
  productName: z.string().min(1, "Product name is required").default("Untitled Product"),
  brandName: z.string().optional(),
  sku: z.string().optional(),
  description: z.string().optional(),
  quantity: z.coerce.number().int().min(0).default(0),
  sizes: z.array(z.string()).default([]),
  color: z.string().optional(),
  moq: z.coerce.number().int().min(0).optional(),
  hsnCode: z.string().optional(),
  gstPercent: z.coerce
    .number()
    .refine((v) => (GST_RATE_OPTIONS as readonly number[]).includes(v), "GST rate must be 0%, 5%, 12%, or 18%")
    .default(0),
  priceBeforeGst: z.coerce.number().min(0).default(0),
  priceAfterGst: z.coerce.number().min(0).default(0),
  currency: z.string().default("INR"),
  shippingCost: z.coerce.number().min(0).default(0),
  miscCost: z.coerce.number().min(0).default(0),
  leadTime: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "DRAFT"]).default("ACTIVE"),
  notes: z.string().optional(),
  warehouse: z.string().optional(),
  gender: z.string().optional(),
});

export type CatalogRowInput = z.infer<typeof catalogRowInputSchema>;
