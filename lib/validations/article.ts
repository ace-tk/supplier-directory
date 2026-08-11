import { z } from "zod";

export const articleFormSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "URL is required")
    .refine((v) => {
      try {
        const u = new URL(v);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    }, "Enter a valid http(s) URL"),
  title: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  thumbnailUrl: z.string().optional(),
});

export type ArticleFormValues = z.infer<typeof articleFormSchema>;
