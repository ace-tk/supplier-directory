// Real, DB-backed read layer for Content Management — scoped strictly to the
// current user (each portal user manages their own content library).

import { db } from "@/lib/db";
import type { ContentItemRecord, ContentItemSummary } from "@/types/content";

const detailInclude = {
  owner: { select: { name: true } },
  attachments: { orderBy: { createdAt: "asc" as const } },
};

type ContentWithRelations = NonNullable<Awaited<ReturnType<typeof fetchContentRaw>>>;

function fetchContentRaw(id: string) {
  return db.contentItem.findUnique({ where: { id }, include: detailInclude });
}

function mapContent(c: ContentWithRelations): ContentItemRecord {
  return {
    id: c.id,
    title: c.title,
    category: c.category,
    tags: c.tags,
    featuredImageUrl: c.featuredImageUrl,
    bodyHtml: c.bodyHtml,
    status: c.status,
    prompt: c.prompt,
    contentType: c.contentType,
    language: c.language,
    tone: c.tone,
    audience: c.audience,
    isTemplate: c.isTemplate,
    ownerId: c.ownerId,
    ownerName: c.owner.name,
    attachments: c.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      dataUrl: a.dataUrl,
      createdAt: a.createdAt.toISOString(),
    })),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    publishedAt: c.publishedAt ? c.publishedAt.toISOString() : null,
  };
}

function mapSummary(c: {
  id: string;
  title: string;
  category: string | null;
  tags: string[];
  featuredImageUrl: string | null;
  status: ContentItemRecord["status"];
  contentType: ContentItemRecord["contentType"];
  isTemplate: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { attachments: number };
}): ContentItemSummary {
  return {
    id: c.id,
    title: c.title,
    category: c.category,
    tags: c.tags,
    featuredImageUrl: c.featuredImageUrl,
    status: c.status,
    contentType: c.contentType,
    isTemplate: c.isTemplate,
    attachmentCount: c._count.attachments,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function getContentItemForOwner(id: string, ownerId: string): Promise<ContentItemRecord | null> {
  const raw = await fetchContentRaw(id);
  if (!raw || raw.ownerId !== ownerId) return null;
  return mapContent(raw);
}

export async function getContentListForOwner(ownerId: string): Promise<ContentItemSummary[]> {
  const rows = await db.contentItem.findMany({
    where: { ownerId },
    include: { _count: { select: { attachments: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return rows.map(mapSummary);
}

export async function getTemplatesForOwner(ownerId: string): Promise<ContentItemSummary[]> {
  const rows = await db.contentItem.findMany({
    where: { ownerId, isTemplate: true },
    include: { _count: { select: { attachments: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return rows.map(mapSummary);
}
