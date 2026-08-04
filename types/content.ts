import type { ContentStatus } from "@/lib/generated/prisma/enums";

export type { ContentStatus };

export interface ContentAttachmentEntry {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  createdAt: string;
}

export interface ContentItemRecord {
  id: string;
  title: string;
  category: string | null;
  tags: string[];
  featuredImageUrl: string | null;
  bodyHtml: string;
  status: ContentStatus;
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
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
}
