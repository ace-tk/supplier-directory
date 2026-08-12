"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, X, MoreHorizontal, Download, Sparkles, PencilLine, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { DocumentViewer } from "./DocumentViewer";
import { AISummaryDialog } from "./AISummaryDialog";
import { extractPdfText, dataUrlToText } from "@/lib/pdf-client";
import { getFileTypeLabel, isPdf, isText } from "@/lib/content-file-types";
import { formatFileSize, formatDateTime } from "@/lib/content-ui";
import type { DraftAttachment } from "@/types/content";

function downloadDataUrl(dataUrl: string, fileName: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Real per-file text extraction for the two formats this app can
 * genuinely read (TXT decodes directly; PDF via pdfjs's own text layer).
 * Returns null for every other format — callers must not fabricate a
 * summary or an "extracted" editor insert for those. */
async function extractText(file: DraftAttachment): Promise<string | null> {
  if (isText(file.mimeType)) return dataUrlToText(file.dataUrl);
  if (isPdf(file.mimeType)) {
    const text = await extractPdfText(file.dataUrl);
    return text.trim() ? text : null;
  }
  return null;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Plain extracted text -> a simple HTML fragment (one <p> per blank-line
 * paragraph) — real content, not markup the source never had. */
function textToHtml(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

/**
 * The center document-viewer column (Files=left, Viewer=center, Editor=
 * right). Opens only when a file is explicitly selected — never
 * auto-inserts anything into the rich text editor; that only happens if
 * the user clicks "Edit in Editor" here, and only for formats this app can
 * genuinely extract text from (TXT, PDF-with-a-text-layer). Everything
 * else gets an honest "not available" state instead of a fake action.
 */
export function DocumentViewerPanel({
  file,
  onClose,
  onEditInEditor,
}: {
  file: DraftAttachment;
  onClose: () => void;
  onEditInEditor: (html: string) => void;
}) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summarySource, setSummarySource] = useState<string | null>(null);
  const [extracting, setExtracting] = useState<"summarize" | "edit" | null>(null);

  const extractable = isText(file.mimeType) || isPdf(file.mimeType);

  async function handleSummarize() {
    setExtracting("summarize");
    try {
      const text = await extractText(file);
      setSummarySource(text ? textToHtml(text) : null);
      setSummaryOpen(true);
    } catch {
      toast.error("Couldn't extract text from this file.");
    } finally {
      setExtracting(null);
    }
  }

  async function handleEditInEditor() {
    setExtracting("edit");
    try {
      const text = await extractText(file);
      if (!text) {
        toast.error("No extractable text found in this file.");
        return;
      }
      onEditInEditor(textToHtml(text));
      toast.success(`Inserted ${file.fileName}'s content into the editor.`);
    } catch {
      toast.error("Couldn't extract text from this file.");
    } finally {
      setExtracting(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col h-[70vh] min-h-[420px] lg:h-[calc(100vh-210px)] lg:min-h-[700px]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-sm font-medium text-foreground truncate flex-1 min-w-0">{file.fileName}</p>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More viewer actions" />}>
            <MoreHorizontal className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => downloadDataUrl(file.dataUrl, file.fileName)}>
              <Download className="h-3.5 w-3.5" /> Download
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Collapse viewer" />}>
            <X className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent>Collapse viewer</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex-1 min-h-0">
        <DocumentViewer key={file.id ?? file.fileName} file={file} variant="large" />
      </div>

      <div className="flex items-center gap-3 px-3 py-2.5 border-t border-border bg-muted/20 shrink-0 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted text-muted-foreground shrink-0">
            <FileText className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{file.fileName}</p>
            <p className="text-[11px] text-muted-foreground">
              {getFileTypeLabel(file.mimeType)} Document · {formatFileSize(file.sizeBytes)}
              {file.createdAt ? ` · Uploaded ${formatDateTime(file.createdAt)}` : " · Not saved yet"}
            </p>
          </div>
        </div>
        {extractable ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5" disabled={extracting !== null} onClick={handleSummarize}>
              {extracting === "summarize" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              AI Summarize
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" disabled={extracting !== null} onClick={handleEditInEditor}>
              {extracting === "edit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PencilLine className="h-3.5 w-3.5" />}
              Edit in Editor
            </Button>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground shrink-0 max-w-[220px] text-right">
            AI Summarize and Edit in Editor aren&apos;t available for this file type.
          </p>
        )}
      </div>

      <AISummaryDialog
        key={summaryOpen ? `summarize-${file.id ?? file.fileName}` : "closed"}
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        sourceHtml={summarySource}
        title={file.fileName}
      />
    </div>
  );
}
