"use client";

import { useRef, useState, type ReactNode } from "react";
import { FileText } from "lucide-react";
import { getFileTypeLabel, isPdf } from "@/lib/content-file-types";
import { getPdfThumbnail } from "@/lib/pdf-thumbnail-cache";
import { formatFileSize, formatDateTime } from "@/lib/content-ui";
import type { DraftAttachment } from "@/types/content";

/**
 * Lightweight hover-triggered details card — pure CSS `:hover`, no click
 * binding anywhere in this component. Base UI's Popover/PopoverTrigger
 * always wires up its own click-to-open handler even with `openOnHover`
 * set (there's no prop to disable it), which meant the wrapped row's own
 * click-to-select handler and the popover's click-to-open handler fired on
 * the same click — this is why selecting a file card felt broken. A real
 * PDF page-1 thumbnail is rendered lazily on first hover (and cached);
 * other file types show an icon rather than a fabricated thumbnail.
 */
export function FileHoverPreview({ file, children }: { file: DraftAttachment; children: ReactNode }) {
  const [thumb, setThumb] = useState<{ dataUrl: string; numPages: number } | null | undefined>(undefined);
  const loadingRef = useRef(false);

  function handleMouseEnter() {
    if (isPdf(file.mimeType) && thumb === undefined && !loadingRef.current) {
      loadingRef.current = true;
      getPdfThumbnail(file.id, file.dataUrl).then(setThumb);
    }
  }

  return (
    <div className="relative group/filehover" onMouseEnter={handleMouseEnter}>
      {children}
      <div
        className="pointer-events-none absolute left-full top-0 z-50 ml-2 w-56 rounded-lg border border-border bg-popover p-3 space-y-2 shadow-lg opacity-0 invisible transition-opacity duration-150 group-hover/filehover:opacity-100 group-hover/filehover:visible"
      >
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
      </div>
    </div>
  );
}
