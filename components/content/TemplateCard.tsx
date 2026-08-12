"use client";

import Link from "next/link";
import { FileText, Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/content-ui";
import { cn } from "@/lib/utils";
import type { ContentItemSummary } from "@/types/content";

export function TemplateCard({
  template,
  basePath,
  selected,
  onSelect,
  onPreview,
}: {
  template: ContentItemSummary;
  basePath: string;
  selected: boolean;
  onSelect: () => void;
  onPreview: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cn(
        "rounded-xl border bg-card p-3 space-y-2.5 cursor-pointer transition-colors group",
        selected ? "border-primary/60 ring-1 ring-primary/30" : "border-border hover:border-primary/30"
      )}
    >
      <div className="aspect-[4/3] rounded-lg bg-muted overflow-hidden flex items-center justify-center">
        {template.featuredImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={template.featuredImageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <FileText className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{template.title}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {template.category || "Uncategorized"} · {formatShortDate(template.updatedAt)}
        </p>
      </div>
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="outline"
          size="sm"
          className="h-6 flex-1 text-[11px] gap-1 px-1.5"
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
        >
          <Eye className="h-3 w-3" /> Preview
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 flex-1 text-[11px] gap-1 px-1.5"
          render={<Link href={`${basePath}/${template.id}`} onClick={(e: React.MouseEvent) => e.stopPropagation()} />}
          nativeButton={false}
        >
          <Pencil className="h-3 w-3" /> Edit
        </Button>
      </div>
    </div>
  );
}
