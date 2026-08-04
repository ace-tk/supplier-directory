"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  Archive,
  Send,
  RotateCcw,
  Paperclip,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/portal/status-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { getContentListAction, setContentStatusAction, deleteContentAction } from "@/services/content";
import { CONTENT_STATUS_LABELS, CONTENT_CATEGORIES, formatShortDate } from "@/lib/content-ui";
import type { ContentItemSummary, ContentStatus } from "@/types/content";
import { cn } from "@/lib/utils";

type TabValue = "ALL" | ContentStatus;

export function ContentDashboard({ basePath }: { basePath: string }) {
  const [items, setItems] = useState<ContentItemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabValue>("ALL");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [deleteTarget, setDeleteTarget] = useState<ContentItemSummary | null>(null);

  function refresh() {
    getContentListAction().then((result) => {
      if (result.success) setItems(result.data);
      else toast.error(result.error);
      setLoading(false);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  const counts = useMemo(
    () => ({
      ALL: items.length,
      DRAFT: items.filter((i) => i.status === "DRAFT").length,
      PUBLISHED: items.filter((i) => i.status === "PUBLISHED").length,
      ARCHIVED: items.filter((i) => i.status === "ARCHIVED").length,
    }),
    [items]
  );

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (tab !== "ALL" && i.status !== tab) return false;
      if (category !== "All Categories" && i.category !== category) return false;
      if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, tab, category, search]);

  async function handleStatusChange(id: string, status: ContentStatus) {
    const result = await setContentStatusAction(id, status);
    if (!result.success) return toast.error(result.error);
    toast.success(`Marked as ${CONTENT_STATUS_LABELS[status].toLowerCase()}`);
    refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await deleteContentAction(deleteTarget.id);
    if (!result.success) return toast.error(result.error);
    toast.success("Content deleted");
    setDeleteTarget(null);
    refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Management"
        description="Create and manage rich content across your organization."
        actions={
          <Link href={`${basePath}/new`}>
            <Button className="gap-1.5">
              <Plus className="h-4 w-4" /> Create Content
            </Button>
          </Link>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => v && setTab(v as TabValue)}>
          <TabsList>
            <TabsTrigger value="ALL">All ({counts.ALL})</TabsTrigger>
            <TabsTrigger value="DRAFT">Drafts ({counts.DRAFT})</TabsTrigger>
            <TabsTrigger value="PUBLISHED">Published ({counts.PUBLISHED})</TabsTrigger>
            <TabsTrigger value="ARCHIVED">Archived ({counts.ARCHIVED})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search content..."
              className="pl-8 w-48"
            />
          </div>
          <Select value={category} onValueChange={(v) => v && setCategory(v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Categories">All Categories</SelectItem>
              {CONTENT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card h-64 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={items.length === 0 ? "No content yet" : "No content matches your filters"}
          description={items.length === 0 ? "Create your first piece of content to get started." : "Try adjusting your search or filters."}
          action={items.length === 0 ? { label: "Create Content", onClick: () => (window.location.href = `${basePath}/new`) } : undefined}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <div key={item.id} className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-card hover:border-border/80 transition-all flex flex-col">
              <div className="aspect-video bg-muted overflow-hidden">
                {item.featuredImageUrl ? (
                  <img src={item.featuredImageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileText className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground line-clamp-2">{item.title}</p>
                  <StatusBadge status={CONTENT_STATUS_LABELS[item.status]} />
                </div>
                {item.category && <p className="text-xs text-muted-foreground">{item.category}</p>}
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.tags.slice(0, 3).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px] font-normal">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="mt-auto pt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Updated {formatShortDate(item.updatedAt)}</span>
                  {item.attachmentCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Paperclip className="h-3 w-3" /> {item.attachmentCount}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 border-t border-border/60 px-2 py-1.5">
                <Link href={`${basePath}/${item.id}`} className="flex-1">
                  <Button variant="ghost" size="sm" className="w-full gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                </Link>
                <Link href={`${basePath}/${item.id}?preview=1`}>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Preview">
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                {item.status !== "PUBLISHED" && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Publish" onClick={() => handleStatusChange(item.id, "PUBLISHED")}>
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                )}
                {item.status !== "ARCHIVED" ? (
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Archive" onClick={() => handleStatusChange(item.id, "ARCHIVED")}>
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Restore to draft" onClick={() => handleStatusChange(item.id, "DRAFT")}>
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-8 w-8 text-muted-foreground hover:text-destructive")}
                  aria-label="Delete"
                  onClick={() => setDeleteTarget(item)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this content?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.title}&rdquo; will be permanently deleted. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
