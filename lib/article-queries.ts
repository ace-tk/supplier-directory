// Real, DB-backed read layer for Articles — scoped per owner, same
// ownership pattern as Catalog/Expenses.

import { db } from "@/lib/db";
import type { ArticleRecord, ArticleListFilter } from "@/types/article";

function mapArticle(a: {
  id: string;
  ownerId: string;
  url: string;
  title: string | null;
  description: string | null;
  notes: string | null;
  category: string | null;
  tags: string[];
  thumbnailUrl: string | null;
  sourceDomain: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ArticleRecord {
  return {
    id: a.id,
    ownerId: a.ownerId,
    url: a.url,
    title: a.title,
    description: a.description,
    notes: a.notes,
    category: a.category,
    tags: a.tags,
    thumbnailUrl: a.thumbnailUrl,
    sourceDomain: a.sourceDomain,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export async function getArticleById(id: string): Promise<ArticleRecord | null> {
  const row = await db.article.findUnique({ where: { id, archivedAt: null } });
  return row ? mapArticle(row) : null;
}

export async function listArticlesForOwner(ownerId: string, filter: ArticleListFilter): Promise<ArticleRecord[]> {
  const rows = await db.article.findMany({
    where: {
      ownerId,
      archivedAt: null,
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.tag ? { tags: { has: filter.tag } } : {}),
      ...(filter.search
        ? {
            OR: [
              { title: { contains: filter.search, mode: "insensitive" as const } },
              { description: { contains: filter.search, mode: "insensitive" as const } },
              { url: { contains: filter.search, mode: "insensitive" as const } },
              { notes: { contains: filter.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapArticle);
}
