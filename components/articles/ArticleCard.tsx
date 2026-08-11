"use client";

import { ExternalLink, Pencil, Trash2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/invoicing/ui";
import type { ArticleRecord } from "@/types/article";

export function ArticleCard({
  article,
  onEdit,
  onDelete,
}: {
  article: ArticleRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group rounded-2xl border border-border bg-card overflow-hidden flex flex-col hover:border-primary/40 transition-colors">
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="block aspect-video bg-muted overflow-hidden"
      >
        {article.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.thumbnailUrl} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Link2 className="h-6 w-6" />
          </div>
        )}
      </a>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <a href={article.url} target="_blank" rel="noopener noreferrer nofollow" className="min-w-0">
            <p className="text-sm font-semibold text-foreground line-clamp-2 hover:text-primary transition-colors">
              {article.title || article.url}
            </p>
          </a>
        </div>

        {article.sourceDomain && <p className="text-[11px] text-muted-foreground truncate">{article.sourceDomain}</p>}

        {article.description && <p className="text-xs text-muted-foreground line-clamp-2">{article.description}</p>}

        {(article.category || article.tags.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {article.category && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{article.category}</span>
            )}
            {article.tags.map((tag) => (
              <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-2 flex items-center justify-between border-t border-border/60">
          <span className="text-[11px] text-muted-foreground">Saved {formatShortDate(article.createdAt)}</span>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open article"
              render={<a href={article.url} target="_blank" rel="noopener noreferrer nofollow" />}
              nativeButton={false}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Delete" className="text-muted-foreground hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
