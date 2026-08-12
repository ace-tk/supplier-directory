"use client";

import { FileText, X } from "lucide-react";
import { getFileTypeLabel } from "@/lib/content-file-types";
import { formatFileSize, formatDateTime } from "@/lib/content-ui";
import { cn } from "@/lib/utils";
import type { DraftAttachment } from "@/types/content";

export function AttachedFileCard({
  file,
  selected,
  onClick,
  onRemove,
}: {
  file: DraftAttachment;
  selected: boolean;
  onClick: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-2.5 py-2 cursor-pointer transition-colors group",
        selected ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/50"
      )}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted text-muted-foreground shrink-0">
        <FileText className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground truncate">{file.fileName}</p>
        <p className="text-[10px] text-muted-foreground">
          {getFileTypeLabel(file.mimeType)} · {formatFileSize(file.sizeBytes)}
          {file.createdAt ? ` · ${formatDateTime(file.createdAt)}` : " · Pending upload"}
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 shrink-0"
        aria-label={`Remove ${file.fileName}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
