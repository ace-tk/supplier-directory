import { z } from "zod";

export const contentAttachmentSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number(),
  dataUrl: z.string().min(1),
});

export const saveContentSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2, "Title is required"),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  featuredImageUrl: z.string().optional(),
  bodyHtml: z.string().default(""),
  attachments: z.array(contentAttachmentSchema).default([]),
});

export type SaveContentInput = z.infer<typeof saveContentSchema>;
