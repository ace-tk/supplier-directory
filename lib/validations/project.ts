import { z } from "zod";

const PHONE_REGEX = /^[+]?[\d\s()-]{7,20}$/;

const optionalUrl = z
  .string()
  .trim()
  .refine((v) => v === "" || z.string().url().safeParse(v).success, "Enter a valid URL")
  .optional();

const optionalEmail = z
  .string()
  .trim()
  .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email address")
  .optional();

const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === "" || PHONE_REGEX.test(v), "Enter a valid phone number")
  .optional();

export const timelineEntrySchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Timeline title is required"),
  description: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "DELAYED"]),
});

export const referenceLinkSchema = z.object({
  id: z.string(),
  platform: z.enum(["WEBSITE", "INSTAGRAM", "LINKEDIN", "BEHANCE", "DRIBBBLE", "GOOGLE_DRIVE", "FIGMA"]),
  url: z.string().min(1, "URL is required").url("Enter a valid URL"),
});

export const referenceImageSchema = z.object({
  id: z.string(),
  dataUrl: z.string().min(1),
  caption: z.string().optional(),
  mimeType: z.string(),
  sizeBytes: z.number(),
});

export const projectDocumentSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  dataUrl: z.string().min(1),
});

export const projectItemSchema = z.object({
  id: z.string(),
  category: z.string().min(1, "Category is required"),
  name: z.string().min(1, "Item name is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  sizes: z.array(z.string()).default([]),
  priceBeforeGst: z.coerce.number().min(0, "Must be 0 or more"),
  priceAfterGst: z.coerce.number().min(0, "Must be 0 or more"),
  shippingCost: z.coerce.number().min(0, "Must be 0 or more").default(0),
  miscCost: z.coerce.number().min(0, "Must be 0 or more").default(0),
  leadTime: z.string().optional(),
});

// Untouched placeholder rows (e.g. the single Timeline entry the form
// starts with) are stripped *before* per-row validation runs, so an empty
// starter row never blocks submission — only rows the admin actually
// started filling in are required to be complete.
function nonBlankArray<T extends z.ZodTypeAny>(schema: T, isBlank: (row: Record<string, unknown>) => boolean) {
  return z.preprocess(
    (val) => (Array.isArray(val) ? val.filter((row) => row && typeof row === "object" && !isBlank(row as Record<string, unknown>)) : val),
    z.array(schema).default([])
  );
}

export const createProjectSchema = z
  .object({
    // Section 1 — Project Details
    name: z.string().min(2, "Project name is required"),
    clientName: z.string().min(1, "Client name is required"),
    city: z.string().optional(),
    pointOfContact: z.string().optional(),
    whatsapp: optionalPhone,
    email: optionalEmail,
    linkedinUrl: optionalUrl,
    notes: z.string().optional(),

    // Section 2 — Timeline
    timeline: nonBlankArray(timelineEntrySchema, (r) => !String(r.title ?? "").trim()),

    // Section 3 — References
    referenceLinks: nonBlankArray(referenceLinkSchema, (r) => !String(r.url ?? "").trim()),
    referenceImages: z.array(referenceImageSchema).default([]),

    // Section 4 — Document Folder
    documents: z.array(projectDocumentSchema).default([]),

    // Section 5 — Schedule
    startDate: z.string().min(1, "Start date is required"),
    expectedEndDate: z.string().min(1, "Target completion date is required"),

    // Section 6 — Supply Chain
    supplyChainId: z.string().optional(),

    // Section 7 — Items
    items: nonBlankArray(projectItemSchema, (r) => !String(r.category ?? "").trim() && !String(r.name ?? "").trim()),
  })
  .refine((data) => new Date(data.expectedEndDate) >= new Date(data.startDate), {
    message: "Target date must be on or after the start date",
    path: ["expectedEndDate"],
  });

export type CreateProjectFormValues = z.infer<typeof createProjectSchema>;
export type TimelineEntryValues = z.infer<typeof timelineEntrySchema>;
export type ReferenceLinkValues = z.infer<typeof referenceLinkSchema>;
export type ReferenceImageValues = z.infer<typeof referenceImageSchema>;
export type ProjectDocumentValues = z.infer<typeof projectDocumentSchema>;
export type ProjectItemValues = z.infer<typeof projectItemSchema>;
