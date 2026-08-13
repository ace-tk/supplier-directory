"use client";

import { Download, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFileTypeLabel } from "@/lib/content-file-types";
import { formatFileSize, formatDateTime } from "@/lib/content-ui";
import { downloadDataUrl } from "./shared";
import type { DraftAttachment } from "@/types/content";

/**
 * Truthful fallback for legacy binary Office formats (.doc, .ppt) — these
 * are OLE compound-binary files, not the OOXML zip format the modern
 * renderers (mammoth for DOCX, the PPTX slide parser) understand. Rather
 * than pretend to parse them, this states the limitation plainly and
 * points at the modern format for inline preview.
 */
export function LegacyViewer({ file, modernFormat }: { file: DraftAttachment; modernFormat: string }) {
  const label = getFileTypeLabel(file.mimeType, file.fileName);
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 text-center w-full">
      <FileWarning className="h-8 w-8 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium text-foreground">{file.fileName}</p>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
          Legacy {label} preview isn&apos;t supported — this is the older binary Office format, not the newer zip-based{" "}
          {modernFormat} format our renderer reads. Download to view it, or re-save as {modernFormat} for inline preview.
        </p>
        <p className="text-[11px] text-muted-foreground/80 mt-1">
          {label} · {formatFileSize(file.sizeBytes)}
          {file.createdAt ? ` · Uploaded ${formatDateTime(file.createdAt)}` : ""}
        </p>
      </div>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadDataUrl(file.dataUrl, file.fileName)}>
        <Download className="h-3.5 w-3.5" /> Download
      </Button>
    </div>
  );
}
