"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, Pencil, Sparkles, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentViewer } from "./DocumentViewer";
import { TemplatePreviewDialog } from "./TemplatePreviewDialog";
import { AISummaryDialog } from "./AISummaryDialog";
import { getContentItemAction } from "@/services/content";
import { getFileTypeLabel } from "@/lib/content-file-types";
import { formatFileSize, formatDateTime } from "@/lib/content-ui";
import type { ContentItemRecord } from "@/types/content";

export function SelectedTemplatePanel({ basePath, templateId }: { basePath: string; templateId: string | null }) {
  if (!templateId) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-xs text-muted-foreground">Select a template to see its details.</p>
      </div>
    );
  }
  // Keyed by templateId so switching the selection is a fresh mount — the
  // fetch effect below then only ever needs to run once, with no
  // synchronous state reset required to "clear" the previous selection.
  return <TemplateDetails key={templateId} basePath={basePath} templateId={templateId} />;
}

function TemplateDetails({ basePath, templateId }: { basePath: string; templateId: string }) {
  const [item, setItem] = useState<ContentItemRecord | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [summarizeOpen, setSummarizeOpen] = useState(false);

  useEffect(() => {
    getContentItemAction(templateId).then((r) => {
      if (r.success) setItem(r.data);
      else toast.error(r.error);
    });
    // Runs once per mount — a new templateId remounts this component (see key above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!item) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const firstAttachment = item.attachments[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-semibold text-foreground">Selected Template</p>
        <div className="aspect-video rounded-lg bg-muted overflow-hidden flex items-center justify-center">
          {item.featuredImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.featuredImageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <FileText className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{item.category || "Uncategorized"}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-2 text-[11px]">
          <div>
            <p className="text-foreground font-medium">
              {firstAttachment ? getFileTypeLabel(firstAttachment.mimeType, firstAttachment.fileName) : "Rich Text"}
            </p>
            <p className="text-muted-foreground">Type</p>
          </div>
          <div>
            <p className="text-foreground font-medium">{firstAttachment ? formatFileSize(firstAttachment.sizeBytes) : "—"}</p>
            <p className="text-muted-foreground">Size</p>
          </div>
          <div className="col-span-2">
            <p className="text-foreground font-medium">{formatDateTime(item.updatedAt)}</p>
            <p className="text-muted-foreground">Updated</p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 pt-1">
          <Button variant="outline" size="sm" className="gap-1.5 justify-start" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-3.5 w-3.5" /> Preview
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 justify-start" render={<Link href={`${basePath}/${item.id}`} />} nativeButton={false}>
            <Pencil className="h-3.5 w-3.5" /> Edit Document
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 justify-start" onClick={() => setSummarizeOpen(true)}>
            <Sparkles className="h-3.5 w-3.5" /> AI Summarize
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <p className="text-xs font-semibold text-foreground">Document Preview</p>
        {firstAttachment ? (
          <div className="rounded-lg border border-border overflow-hidden -mx-1">
            <DocumentViewer file={firstAttachment} />
          </div>
        ) : item.bodyHtml.trim() ? (
          <div className="max-h-[360px] overflow-y-auto rounded-lg border border-border p-3">
            <div className="tiptap-content text-xs" dangerouslySetInnerHTML={{ __html: item.bodyHtml }} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-4 text-center">No content yet.</p>
        )}
      </div>

      <TemplatePreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} item={item} />
      <AISummaryDialog
        key={summarizeOpen ? `summarize-${item.id}` : "closed"}
        open={summarizeOpen}
        onOpenChange={setSummarizeOpen}
        sourceHtml={item.bodyHtml}
        title={item.title}
      />
    </div>
  );
}
