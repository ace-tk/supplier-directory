"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { FileText } from "lucide-react";
import { TemplateCard } from "./TemplateCard";
import { TemplateCategorySidebar } from "./TemplateCategorySidebar";
import { SelectedTemplatePanel } from "./SelectedTemplatePanel";
import { TemplatePreviewDialog } from "./TemplatePreviewDialog";
import { getTemplatesAction, getContentItemAction } from "@/services/content";
import type { ContentItemSummary, ContentItemRecord } from "@/types/content";

type SortOrder = "updated" | "created" | "name";

/**
 * The full Template Library — a separate, complete workspace from the
 * compact Templates tab inside the editor, but reading the exact same
 * data (ContentItem rows with isTemplate=true via getTemplatesAction).
 */
export function TemplateLibrary({ basePath, initialCategory }: { basePath: string; initialCategory?: string }) {
  const [templates, setTemplates] = useState<ContentItemSummary[] | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(initialCategory || "All");
  const [sort, setSort] = useState<SortOrder>("updated");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<ContentItemRecord | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    getTemplatesAction().then((r) => {
      if (r.success) setTemplates(r.data);
      else toast.error(r.error);
    });
  }, []);

  const categories = useMemo(() => {
    if (!templates) return [];
    const counts = new Map<string, number>();
    for (const t of templates) {
      const key = t.category || "Uncategorized";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, count]) => ({ label, count }));
  }, [templates]);

  const filtered = useMemo(() => {
    if (!templates) return [];
    let list = templates.filter((t) => {
      if (category !== "All" && (t.category || "Uncategorized") !== category) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "name") return a.title.localeCompare(b.title);
      if (sort === "created") return b.createdAt.localeCompare(a.createdAt);
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    return list;
  }, [templates, category, search, sort]);

  const grouped = useMemo(() => {
    const map = new Map<string, ContentItemSummary[]>();
    for (const t of filtered) {
      const key = t.category || "Uncategorized";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  async function handlePreview(id: string) {
    const result = await getContentItemAction(id);
    if (!result.success) return toast.error(result.error);
    setPreviewItem(result.data);
    setPreviewOpen(true);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Template Library"
        description="Beautiful, ready-to-use templates for every business need."
        breadcrumbs={[{ label: "Content Management", href: basePath }, { label: "Template Library" }]}
      />

      {templates === null ? (
        <div className="h-64 rounded-xl border border-border bg-card animate-pulse" />
      ) : templates.length === 0 ? (
        <EmptyState icon={FileText} title="No templates yet" description="Save any content item as a template to start your library." />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..." className="pl-8 h-8" />
            </div>
            <Select value={category} onValueChange={(v) => v && setCategory(v)}>
              <SelectTrigger className="w-44 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.label} value={c.label}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => v && setSort(v as SortOrder)}>
              <SelectTrigger className="w-44 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">Recently Updated</SelectItem>
                <SelectItem value="created">Recently Created</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid lg:grid-cols-[200px_minmax(0,1fr)_300px] gap-5 items-start">
            <div className="hidden lg:block">
              <TemplateCategorySidebar basePath={basePath} categories={categories} selected={category} onSelect={setCategory} />
            </div>

            <div className="space-y-6 min-w-0">
              {grouped.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No templates match your search or filters.</p>
              ) : (
                grouped.map(([cat, items]) => (
                  <div key={cat} className="space-y-2.5">
                    <p className="text-sm font-semibold text-foreground">
                      {cat} <span className="text-xs font-normal text-muted-foreground">({items.length})</span>
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                      {items.map((t) => (
                        <TemplateCard
                          key={t.id}
                          template={t}
                          basePath={basePath}
                          selected={selectedId === t.id}
                          onSelect={() => setSelectedId((id) => (id === t.id ? null : t.id))}
                          onPreview={() => handlePreview(t.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden lg:block">
              <SelectedTemplatePanel basePath={basePath} templateId={selectedId} />
            </div>
          </div>

          {selectedId && (
            <div className="lg:hidden">
              <SelectedTemplatePanel basePath={basePath} templateId={selectedId} />
            </div>
          )}
        </>
      )}

      {previewItem && <TemplatePreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} item={previewItem} />}
    </div>
  );
}
