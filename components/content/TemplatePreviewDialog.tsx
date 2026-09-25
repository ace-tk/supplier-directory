"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { ContentItemRecord } from "@/types/content";

export function TemplatePreviewDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ContentItemRecord;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {item.category && <Badge variant="secondary">{item.category}</Badge>}
            {item.tags.map((t) => (
              <Badge key={t} variant="secondary" className="font-normal">
                {t}
              </Badge>
            ))}
          </div>
          {item.featuredImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.featuredImageUrl} alt={item.title} className="w-full aspect-video object-cover rounded-xl" />
          )}
          {item.bodyHtml.trim() ? (
            <div className="tiptap-content text-sm" dangerouslySetInnerHTML={{ __html: item.bodyHtml }} />
          ) : (
            <p className="text-sm text-muted-foreground">This template has no content yet.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
