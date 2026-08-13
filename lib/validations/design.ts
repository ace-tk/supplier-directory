import { z } from "zod";

export const designSpecificationSchema = z.object({
  fabric: z.string().optional(),
  color: z.string().optional(),
  fit: z.string().optional(),
  sizes: z.array(z.string()).optional(),
  waist: z.string().optional(),
  buttons: z.string().optional(),
  pockets: z.string().optional(),
  labels: z.string().optional(),
  packaging: z.string().optional(),
  otherDetails: z.string().optional(),
});

export type DesignSpecificationInput = z.infer<typeof designSpecificationSchema>;

export const saveDesignSchema = z.object({
  id: z.string().optional(), // present => update an existing design
  productId: z.string().min(1),
  name: z.string().min(1).default("My Design"),
  specification: designSpecificationSchema,
  notes: z.string().optional(),
});

export type SaveDesignInput = z.infer<typeof saveDesignSchema>;

export const submitManufacturingRequestSchema = z.object({
  productId: z.string().min(1),
  designId: z.string().optional(),
  specification: designSpecificationSchema,
  quantity: z.coerce.number().int().min(1, "Enter a required quantity"),
  targetPrice: z.coerce.number().min(0).optional(),
  currency: z.string().default("INR"),
  sampleRequired: z.boolean().default(false),
  deliveryLocation: z.string().optional(),
  requiredBy: z.string().optional(), // ISO date string
  notes: z.string().optional(),
});

export type SubmitManufacturingRequestInput = z.infer<typeof submitManufacturingRequestSchema>;
