import { z } from "zod";

export const supportRequestTypeSchema = z.enum(["TICKET", "BUG_REPORT", "FEATURE_REQUEST"]);
export const supportRequestCategorySchema = z.enum([
  "ACCOUNT",
  "SUPPLIER_BUYER",
  "CRM",
  "ORDERS",
  "INVOICES",
  "PROJECTS",
  "TEAM",
  "MARKETING",
  "DESIGN_STUDIO",
  "TECHNICAL",
  "OTHER",
]);
export const supportRequestPrioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);

export const submitSupportRequestSchema = z.object({
  type: supportRequestTypeSchema,
  subject: z.string().trim().min(3, "Subject must be at least 3 characters").max(160),
  category: supportRequestCategorySchema,
  priority: supportRequestPrioritySchema,
  description: z.string().trim().min(10, "Please add a bit more detail (at least 10 characters)").max(5000),
  module: z.string().trim().max(120).optional(),
  route: z.string().trim().max(300).optional(),
  attachment: z
    .object({
      dataUrl: z.string(),
      name: z.string().max(255),
    })
    .optional(),
});

export type SubmitSupportRequestInput = z.infer<typeof submitSupportRequestSchema>;
