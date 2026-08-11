export interface ArticleRecord {
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

  createdAt: string;
  updatedAt: string;
}

export interface ArticleListFilter {
  search?: string;
  category?: string;
  tag?: string;
}

export interface ArticleMetadata {
  title: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  sourceDomain: string | null;
}

export type ArticleActionResult<T = void> = { success: true; data: T } | { success: false; error: string };
