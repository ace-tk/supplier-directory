import { z } from "zod";

const urlOrEmpty = z.string().url("Enter a valid URL").optional().or(z.literal(""));

export const createFreelancerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone: z
    .string()
    .regex(/^[0-9+\-\s()]{7,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  role: z.string().trim().min(2, "Professional role is required").max(80),
  company: z.string().max(120).optional().or(z.literal("")),
  location: z.string().max(120).optional().or(z.literal("")),
  bio: z.string().max(1000).optional().or(z.literal("")),
  skills: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  availability: z.enum(["AVAILABLE", "BUSY", "UNAVAILABLE"]).default("AVAILABLE"),
  avatarDataUrl: z.string().optional().or(z.literal("")),
  linkedinUrl: urlOrEmpty,
  instagramUrl: urlOrEmpty,
  behanceUrl: urlOrEmpty,
  dribbbleUrl: urlOrEmpty,
  githubUrl: urlOrEmpty,
});

export type CreateFreelancerFormValues = z.infer<typeof createFreelancerSchema>;
