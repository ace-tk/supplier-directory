import type { ContentStatus, ContentType, ContentLanguage, ContentTone, ContentAudience } from "@/types/content";

export { formatShortDate, formatDateTime, formatFileSize } from "@/lib/supply-chain-ui";

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export const CONTENT_CATEGORIES = [
  "Announcement",
  "Product Update",
  "Guide",
  "Policy",
  "Newsletter",
  "Case Study",
  "Other",
];

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  PRODUCT_DESCRIPTION: "Product Description",
  COMPANY_PROFILE: "Company Profile",
  EMAIL: "Email",
  NEWSLETTER: "Newsletter",
  LINKEDIN_POST: "LinkedIn Post",
  INSTAGRAM_CAPTION: "Instagram Caption",
  WEBSITE_CONTENT: "Website Content",
  BLOG: "Blog",
  CATALOG_DESCRIPTION: "Catalog Description",
  OTHER: "Other",
};

export const CONTENT_LANGUAGE_LABELS: Record<ContentLanguage, string> = {
  ENGLISH: "English",
  FRENCH: "French",
  GERMAN: "German",
};

export const CONTENT_TONE_LABELS: Record<ContentTone, string> = {
  PROFESSIONAL: "Professional",
  FRIENDLY: "Friendly",
  LUXURY: "Luxury",
  TECHNICAL: "Technical",
  MARKETING: "Marketing",
};

export const CONTENT_AUDIENCE_LABELS: Record<ContentAudience, string> = {
  BUYERS: "Buyers",
  SUPPLIERS: "Suppliers",
  EXPORTERS: "Exporters",
  RETAILERS: "Retailers",
  MANUFACTURERS: "Manufacturers",
};
