"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArticleCard } from "./ArticleCard";
import { ArticleFormDialog } from "./ArticleFormDialog";
import { listArticlesAction, deleteArticleAction } from "@/services/article";
import type { ArticleRecord } from "@/types/article";

type SortOrder = "newest" | "oldest";

/** A saved-link research library — deliberately lightweight, not a second
 * Content Management system. All CRUD happens through dialogs on this one
 * page (no separate add/edit routes), consistent with how small this
 * feature is meant to stay. */
export function ArticlesBoard({ basePath }: { basePath: string }) {
  const [articles, setArticles] = useState<ArticleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [tagFilter, setTagFilter] = useState("All");
  const [sort, setSort] = useState<SortOrder>("newest");

  const [formOpen, setFormOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<ArticleRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ArticleRecord | null>(null);

  function refresh() {
    listArticlesAction({}).then((r) => {
      if (r.success) setArticles(r.data);
      else toast.error(r.error);
      setLoading(false);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  const categories = useMemo(() => [...new Set(articles.map((a) => a.category).filter((c): c is string => !!c))], [articles]);
  const tags = useMemo(() => [...new Set(articles.flatMap((a) => a.tags))], [articles]);

  const filtered = useMemo(() => {
    let list = articles.filter((a) => {
      if (categoryFilter !== "All" && a.category !== categoryFilter) return false;
      if (tagFilter !== "All" && !a.tags.includes(tagFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${a.title ?? ""} ${a.description ?? ""} ${a.url} ${a.sourceDomain ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) =>
      sort === "newest" ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)
    );
    return list;
  }, [articles, search, categoryFilter, tagFilter, sort]);

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteArticleAction(deleteTarget.id);
    if (!result.success) return toast.error(result.error);
    setArticles((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success("Article deleted");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Articles"
        description="Save useful links you find online — they show up here as tiles you can revisit anytime."
        actions={
          <Button
            className="gap-1.5"
            onClick={() => {
              setEditingArticle(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add Article
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search articles..." className="pl-8 w-64" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={categoryFilter} onValueChange={(v) => v && setCategoryFilter(v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tags.length > 0 && (
            <Select value={tagFilter} onValueChange={(v) => v && setTagFilter(v)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Tags</SelectItem>
                {tags.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={sort} onValueChange={(v) => v && setSort(v as SortOrder)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card h-64 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={articles.length === 0 ? "No articles saved yet" : "No articles match your filters"}
          description={articles.length === 0 ? "Save your first link to start building your research library." : "Try adjusting your search or filters."}
          action={
            articles.length === 0
              ? {
                  label: "Add Article",
                  onClick: () => {
                    setEditingArticle(null);
                    setFormOpen(true);
                  },
                }
              : undefined
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              onEdit={() => {
                setEditingArticle(article);
                setFormOpen(true);
              }}
              onDelete={() => setDeleteTarget(article)}
            />
          ))}
        </div>
      )}

      <ArticleFormDialog
        key={formOpen ? (editingArticle?.id ?? "new") : "closed"}
        open={formOpen}
        onOpenChange={setFormOpen}
        article={editingArticle}
        onSaved={refresh}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this article?</AlertDialogTitle>
            <AlertDialogDescription>This saved link will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
