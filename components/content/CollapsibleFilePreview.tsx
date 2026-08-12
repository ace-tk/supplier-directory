"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { DocumentViewer } from "./DocumentViewer";
import { getFileTypeLabel } from "@/lib/content-file-types";
import { cn } from "@/lib/utils";
import type { DraftAttachment } from "@/types/content";

/** Collapsed by default — the viewer never permanently occupies the
 * editor. A single header row toggles it open/closed. */
export function CollapsibleFilePreview({ file }: { file: DraftAttachment }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
      >
        <span className="truncate">
          {getFileTypeLabel(file.mimeType)} Preview ({file.fileName})
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <div className="border-t border-border">
          <DocumentViewer file={file} />
        </div>
      )}
    </div>
  );
}
