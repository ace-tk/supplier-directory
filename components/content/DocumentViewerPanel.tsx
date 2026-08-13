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
import { renderDocxToHtml } from "@/lib/docx-client";
import { readPptx, pptxToOutlineHtml } from "@/lib/pptx-client";
import { readSpreadsheet, sheetToSummaryHtml } from "@/lib/spreadsheet-client";
import { getFileTypeLabel, getFileKind, type FileKind } from "@/lib/content-file-types";
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

// Formats this app can genuinely extract real content from. XLSX/XLS can
// only feed AI Summarize (via the first sheet) — dumping a full sheet's
// cells into the rich text editor would not be a meaningful "edit"
// experience, so Edit in Editor stays unavailable for spreadsheets.
const SUMMARIZABLE_KINDS: FileKind[] = ["pdf", "text", "docx", "pptx", "spreadsheet"];
const EDITABLE_KINDS: FileKind[] = ["pdf", "text", "docx", "pptx"];

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

/** Real per-format extraction — TXT decodes directly, PDF via pdfjs's text
 * layer, DOCX via mammoth's structural HTML, PPTX via the parsed slide
 * text outline, XLSX/XLS via the first sheet's serialized cells. Returns
 * null when there's genuinely nothing to extract (e.g. a scanned PDF with
 * no text layer, or an empty sheet) — callers must not fabricate content
 * for that case. */
async function extractContentHtml(file: DraftAttachment): Promise<string | null> {
  const kind = getFileKind(file.mimeType, file.fileName);
  switch (kind) {
    case "text": {
      const text = dataUrlToText(file.dataUrl);
      return text.trim() ? textToHtml(text) : null;
    }
    case "pdf": {
      const text = await extractPdfText(file.dataUrl);
      return text.trim() ? textToHtml(text) : null;
    }
    case "docx": {
      const { html } = await renderDocxToHtml(file.dataUrl);
      return html.trim() ? html : null;
    }
    case "pptx": {
      const pres = await readPptx(file.dataUrl);
      const html = pptxToOutlineHtml(pres);
      return html.trim() ? html : null;
    }
    case "spreadsheet": {
      const workbook = await readSpreadsheet(file.dataUrl);
      const sheet = workbook.sheets[0];
      return sheet && sheet.rows.length ? sheetToSummaryHtml(sheet) : null;
    }
    default:
      return null;
  }
}

/**
 * The center document-viewer column (Files=left, Viewer=center, Editor=
 * right). Opens only when a file is explicitly selected — never
 * auto-inserts anything into the rich text editor; that only happens if
 * the user clicks "Edit in Editor" here, and only for formats this app can
 * genuinely extract structured content from. Everything else gets an
 * honest "not available" state instead of a fake action.
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

  const kind = getFileKind(file.mimeType, file.fileName);
  const canSummarize = SUMMARIZABLE_KINDS.includes(kind);
  const canEdit = EDITABLE_KINDS.includes(kind);

  async function handleSummarize() {
    setExtracting("summarize");
    try {
      const html = await extractContentHtml(file);
      setSummarySource(html);
      setSummaryOpen(true);
    } catch {
      toast.error("Couldn't extract content from this file.");
    } finally {
      setExtracting(null);
    }
  }

  async function handleEditInEditor() {
    setExtracting("edit");
    try {
      const html = await extractContentHtml(file);
      if (!html) {
        toast.error("No extractable content found in this file.");
        return;
      }
      onEditInEditor(html);
      toast.success(`Inserted ${file.fileName}'s content into the editor.`);
    } catch {
      toast.error("Couldn't extract content from this file.");
    } finally {
      setExtracting(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col h-[clamp(300px,70vh,900px)] lg:h-[clamp(420px,calc(100vh-210px),1400px)]">
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
              {getFileTypeLabel(file.mimeType, file.fileName)} Document · {formatFileSize(file.sizeBytes)}
              {file.createdAt ? ` · Uploaded ${formatDateTime(file.createdAt)}` : " · Not saved yet"}
            </p>
          </div>
        </div>
        {canSummarize || canEdit ? (
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {canSummarize && (
              <Button variant="outline" size="sm" className="gap-1.5" disabled={extracting !== null} onClick={handleSummarize}>
                {extracting === "summarize" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                AI Summarize
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" size="sm" className="gap-1.5" disabled={extracting !== null} onClick={handleEditInEditor}>
                {extracting === "edit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PencilLine className="h-3.5 w-3.5" />}
                Edit in Editor
              </Button>
            )}
            {canSummarize && !canEdit && (
              <p className="text-[11px] text-muted-foreground w-full text-right">Edit in Editor isn&apos;t available for spreadsheets.</p>
            )}
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
