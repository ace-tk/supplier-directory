import { z } from "zod";

const CATEGORY_VALUES = [
  "SHIPPING",
  "TRAVEL",
  "PACKAGING",
  "TRANSPORTATION",
  "SAMPLES",
  "MARKETING",
  "FREELANCER",
  "OFFICE",
  "MISCELLANEOUS",
  "OTHER",
] as const;

export const expenseFormSchema = z.object({
  occurredAt: z.string().min(1, "Date is required"),
  location: z.string().optional(),
  locationLat: z.number().nullish(),
  locationLng: z.number().nullish(),
  category: z.enum(CATEGORY_VALUES).default("MISCELLANEOUS"),
  customCategoryLabel: z.string().optional(),
  customCategoryId: z.string().nullish(),
  amount: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, "Amount must be 0 or more"),
  currency: z.string().min(1).default("INR"),
  notes: z.string().optional(),
  partyUserId: z.string().nullish(),
  relatedInvoiceId: z.string().nullish(),
  attachmentFileName: z.string().optional(),
  attachmentUrl: z.string().optional(),
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;
