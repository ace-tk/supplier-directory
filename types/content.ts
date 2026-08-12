import type {
  ContentStatus,
  ContentType,
  ContentLanguage,
  ContentTone,
  ContentAudience,
} from "@/lib/generated/prisma/enums";

export type { ContentStatus, ContentType, ContentLanguage, ContentTone, ContentAudience };

export interface ContentAttachmentEntry {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  createdAt: string;
}

/** The editor's in-memory attachment shape — a superset-compatible subset
 * of ContentAttachmentEntry. `id`/`createdAt` are only present for
 * attachments that already exist in the DB; a freshly-added-this-session
 * file has neither until the item is saved. */
export interface DraftAttachment {
  id?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  createdAt?: string;
}

export interface ContentItemRecord {
  id: string;
  title: string;
  category: string | null;
  tags: string[];
  featuredImageUrl: string | null;
  bodyHtml: string;
  status: ContentStatus;
  prompt: string | null;
  contentType: ContentType | null;
  language: ContentLanguage | null;
  tone: ContentTone | null;
  audience: ContentAudience | null;
  isTemplate: boolean;
  ownerId: string;
  ownerName: string;
  attachments: ContentAttachmentEntry[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface ContentItemSummary {
  id: string;
  title: string;
  category: string | null;
  tags: string[];
  featuredImageUrl: string | null;
  status: ContentStatus;
  contentType: ContentType | null;
  isTemplate: boolean;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
}
