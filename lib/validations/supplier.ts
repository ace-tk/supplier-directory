import { z } from "zod";

export const supplierSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  industry: z.string().min(1, "Industry is required"),
  supplierType: z.enum(["Manufacturer", "Exporter", "Wholesaler"]),
  country: z.string().min(1, "Country is required"),
  city: z.string().min(1, "City is required"),
  products: z
    .union([
      z.string().min(1, "At least one product is required").transform((val) =>
        val.split(",").map((p) => p.trim()).filter(Boolean)
      ),
      z.array(z.string()).min(1, "At least one product is required"),
    ]),
  minimumOrder: z.string().optional(),
  responseTime: z.string().optional(),
  phone: z.string().optional(),
  email: z
    .string()
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, {
      message: "Enter a valid email address",
    }),
  website: z.string().optional(),
  whatsapp: z.string().optional(),
  linkedin: z.string().optional(),
  verified: z.boolean().default(false),
  rating: z.coerce.number().min(0).max(5).default(0),
  yearEstablished: z.union([z.coerce.number().min(1800).max(2100), z.literal("")]).optional(),
  employees: z.string().optional(),
  notes: z.string().optional(),
});

export type SupplierFormValues = z.input<typeof supplierSchema>;
export type SupplierFormOutput = z.output<typeof supplierSchema>;
