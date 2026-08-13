"use client";

import { Download, RotateCw, FileWarning, File as FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFileTypeLabel } from "@/lib/content-file-types";
import { formatFileSize, formatDateTime } from "@/lib/content-ui";
import { downloadDataUrl } from "./shared";
import type { DraftAttachment } from "@/types/content";

/**
 * Metadata + download fallback — used for genuinely unsupported formats
 * (message omitted, generic icon) and for a renderer's own parse-error
 * state (message + Retry provided by the caller). Never a fake preview.
 */
export function UnsupportedViewer({
  file,
  message,
  onRetry,
}: {
  file: DraftAttachment;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 text-center w-full">
      {message ? <FileWarning className="h-8 w-8 text-muted-foreground" /> : <FileIcon className="h-8 w-8 text-muted-foreground" />}
      <div>
        <p className="text-sm font-medium text-foreground">{file.fileName}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {message ?? `Inline preview isn't available for ${getFileTypeLabel(file.mimeType, file.fileName)} files.`}
        </p>
        <p className="text-[11px] text-muted-foreground/80 mt-1">
          {getFileTypeLabel(file.mimeType, file.fileName)} · {formatFileSize(file.sizeBytes)}
          {file.createdAt ? ` · Uploaded ${formatDateTime(file.createdAt)}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {onRetry && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
            <RotateCw className="h-3.5 w-3.5" /> Retry
          </Button>
        )}
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadDataUrl(file.dataUrl, file.fileName)}>
          <Download className="h-3.5 w-3.5" /> Download
        </Button>
      </div>
    </div>
  );
}
