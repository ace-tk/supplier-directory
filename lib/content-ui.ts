import type { ContentStatus } from "@/types/content";

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
