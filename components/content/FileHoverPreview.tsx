"use client";

import { useState, type ReactNode } from "react";
import { FileText } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getFileTypeLabel, isPdf } from "@/lib/content-file-types";
import { getPdfThumbnail } from "@/lib/pdf-thumbnail-cache";
import { formatFileSize, formatDateTime } from "@/lib/content-ui";
import type { DraftAttachment } from "@/types/content";

/** Lightweight hover-triggered details card — never opens the full viewer,
 * never covers the row's own controls (positioned to the side). A real PDF
 * page-1 thumbnail is rendered lazily on first hover (and cached); other
 * file types show an icon rather than a fabricated thumbnail. */
export function FileHoverPreview({ file, children }: { file: DraftAttachment; children: ReactNode }) {
  const [thumb, setThumb] = useState<{ dataUrl: string; numPages: number } | null | undefined>(undefined);

  async function handleOpenChange(isOpen: boolean) {
    if (isOpen && isPdf(file.mimeType) && thumb === undefined) {
      setThumb(await getPdfThumbnail(file.id, file.dataUrl));
    }
  }

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger render={<div className="block" />} nativeButton={false} openOnHover delay={350} closeDelay={100}>
        {children}
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-56 p-3 space-y-2">
        <div className="flex items-start gap-2.5">
          {isPdf(file.mimeType) && thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb.dataUrl} alt="" className="w-12 h-16 object-cover rounded border border-border shrink-0 bg-white" />
          ) : (
            <div className="w-12 h-16 rounded border border-border bg-muted flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{file.fileName}</p>
            <p className="text-[11px] text-muted-foreground">
              {getFileTypeLabel(file.mimeType)}
              {isPdf(file.mimeType) && thumb ? ` · ${thumb.numPages} page${thumb.numPages === 1 ? "" : "s"}` : ""}
            </p>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1.5 border-t border-border/60">
          <p>{formatFileSize(file.sizeBytes)}</p>
          <p>{file.createdAt ? formatDateTime(file.createdAt) : "Not saved yet"}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
