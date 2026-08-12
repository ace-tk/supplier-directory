"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FileText, Eye, Pencil, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { TemplatePreviewDialog } from "./TemplatePreviewDialog";
import { getTemplatesAction, getContentItemAction } from "@/services/content";
import type { ContentItemSummary, ContentItemRecord } from "@/types/content";

const PREVIEW_COUNT = 3;

/**
 * A compact browser over the SAME templates the full Template Library
 * shows (ContentItem rows with isTemplate=true) — real categories, real
 * counts, "View more"/"+N more" only ever reflecting actual data.
 */
export function CompactTemplateBrowser({
  basePath,
  onUseTemplate,
}: {
  basePath: string;
  onUseTemplate: (item: ContentItemRecord) => void;
}) {
  const [templates, setTemplates] = useState<ContentItemSummary[] | null>(null);
  const [previewItem, setPreviewItem] = useState<ContentItemRecord | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    getTemplatesAction().then((r) => setTemplates(r.success ? r.data : []));
  }, []);

  async function loadFull(id: string): Promise<ContentItemRecord | null> {
    setLoadingId(id);
    const result = await getContentItemAction(id);
    setLoadingId(null);
    if (!result.success) {
      toast.error(result.error);
      return null;
    }
    return result.data;
  }

  async function handlePreview(id: string) {
    const item = await loadFull(id);
    if (item) {
      setPreviewItem(item);
      setPreviewOpen(true);
    }
  }

  async function handleUse(id: string) {
    const item = await loadFull(id);
    if (item) onUseTemplate(item);
  }

  if (templates === null) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return <EmptyState icon={FileText} title="No templates yet" description="Use “Save Template” from any content item to build your library." />;
  }

  const byCategory = new Map<string, ContentItemSummary[]>();
  for (const t of templates) {
    const key = t.category || "Uncategorized";
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(t);
  }

  return (
    <div className="space-y-4">
      {[...byCategory.entries()].map(([category, items]) => (
        <div key={category} className="space-y-1">
          <p className="text-xs font-semibold text-foreground">{category}</p>
          <div className="space-y-1">
            {items.slice(0, PREVIEW_COUNT).map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1.5 hover:bg-muted/40 transition-colors group"
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-foreground truncate flex-1">{t.title}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-6 w-6"
                    aria-label="Preview"
                    disabled={loadingId === t.id}
                    onClick={() => handlePreview(t.id)}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-6 w-6"
                    aria-label="Edit"
                    render={<Link href={`${basePath}/${t.id}`} />}
                    nativeButton={false}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[11px] px-2 shrink-0"
                  disabled={loadingId === t.id}
                  onClick={() => handleUse(t.id)}
                >
                  Use
                </Button>
              </div>
            ))}
            {items.length > PREVIEW_COUNT && (
              <Link
                href={`${basePath}/templates?category=${encodeURIComponent(category)}`}
                className="flex items-center gap-1 text-[11px] text-primary hover:underline px-2 py-1"
              >
                +{items.length - PREVIEW_COUNT} more <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      ))}

      <Link
        href={`${basePath}/templates`}
        className="flex items-center justify-center gap-1 text-xs font-medium text-primary hover:underline pt-1 border-t border-border/60 mt-1 pt-2.5"
      >
        View full Template Library <ChevronRight className="h-3.5 w-3.5" />
      </Link>

      {previewItem && <TemplatePreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} item={previewItem} />}
    </div>
  );
}
