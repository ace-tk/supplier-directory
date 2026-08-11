"use server";

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { articleFormSchema, type ArticleFormValues } from "@/lib/validations/article";
import { getArticleById, listArticlesForOwner } from "@/lib/article-queries";
import { fetchArticleMetadata } from "@/lib/article-metadata";
import type { ArticleRecord, ArticleListFilter, ArticleActionResult, ArticleMetadata } from "@/types/article";

async function requireUser() {
  return getUser();
}

async function requireOwnedArticle(id: string, ownerId: string) {
  const article = await db.article.findUnique({ where: { id }, select: { ownerId: true } });
  if (!article || article.ownerId !== ownerId) return null;
  return article;
}

function buildArticleData(d: ArticleFormValues) {
  return {
    url: d.url.trim(),
    title: d.title?.trim() || null,
    description: d.description?.trim() || null,
    notes: d.notes?.trim() || null,
    category: d.category?.trim() || null,
    tags: d.tags,
    thumbnailUrl: d.thumbnailUrl?.trim() || null,
  };
}

export async function listArticlesAction(filter: ArticleListFilter): Promise<ArticleActionResult<ArticleRecord[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  return { success: true, data: await listArticlesForOwner(user.id, filter) };
}

export async function getArticleAction(id: string): Promise<ArticleActionResult<ArticleRecord>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  const article = await getArticleById(id);
  if (!article || article.ownerId !== user.id) return { success: false, error: "Article not found." };
  return { success: true, data: article };
}

/** Best-effort — always succeeds with whatever could be resolved (possibly
 * all nulls beyond sourceDomain); never blocks the caller from saving. */
export async function fetchArticleMetadataAction(url: string): Promise<ArticleActionResult<ArticleMetadata>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };
  try {
    new URL(url);
  } catch {
    return { success: false, error: "Enter a valid URL first." };
  }
  return { success: true, data: await fetchArticleMetadata(url) };
}

export async function createArticleAction(input: ArticleFormValues): Promise<ArticleActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const parsed = articleFormSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  let sourceDomain: string | null = null;
  try {
    sourceDomain = new URL(parsed.data.url).hostname.replace(/^www\./, "");
  } catch {
    // already validated by the schema; unreachable
  }

  const created = await db.article.create({
    data: { ...buildArticleData(parsed.data), ownerId: user.id, sourceDomain },
    select: { id: true },
  });
  return { success: true, data: { id: created.id } };
}

export async function updateArticleAction(id: string, input: ArticleFormValues): Promise<ArticleActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const existing = await requireOwnedArticle(id, user.id);
  if (!existing) return { success: false, error: "Article not found." };

  const parsed = articleFormSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  let sourceDomain: string | null = null;
  try {
    sourceDomain = new URL(parsed.data.url).hostname.replace(/^www\./, "");
  } catch {
    // already validated by the schema; unreachable
  }

  await db.article.update({ where: { id }, data: { ...buildArticleData(parsed.data), sourceDomain } });
  return { success: true, data: { id } };
}

export async function deleteArticleAction(id: string): Promise<ArticleActionResult<void>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const existing = await requireOwnedArticle(id, user.id);
  if (!existing) return { success: false, error: "Article not found." };

  await db.article.delete({ where: { id } });
  return { success: true, data: undefined };
}
