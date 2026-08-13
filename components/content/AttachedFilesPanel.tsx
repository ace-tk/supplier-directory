"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Paperclip } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { AttachedFileCard } from "./AttachedFileCard";
import { FileHoverPreview } from "./FileHoverPreview";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { validateDocumentOrImage, MAX_DOCUMENT_BYTES, SUPPORTED_DOCUMENT_LABEL, SUPPORTED_IMAGE_LABEL } from "@/lib/file-validation";
import { cn } from "@/lib/utils";
import type { DraftAttachment } from "@/types/content";

/**
 * Files-only left panel: list, search, drag/drop, Add Files. The document
 * viewer itself lives in the separate center column (DocumentViewerPanel)
 * — it never renders in here, so it's never squeezed into this narrow
 * width. Selection is controlled by the parent (ContentEditor) so the
 * center column and this list can share which file is open.
 */
export function AttachedFilesPanel({
  attachments,
  onAttachmentsChange,
  selected,
  onSelect,
}: {
  attachments: DraftAttachment[];
  onAttachmentsChange: (next: DraftAttachment[]) => void;
  selected: DraftAttachment | null;
  onSelect: (file: DraftAttachment | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    try {
      // Convert every file first and append them all in one state update —
      // calling onAttachmentsChange per-file inside the loop would read the
      // same stale `attachments` closure each time (no re-render happens
      // between awaits within one call), so a second file in the same
      // selection would silently replace the first instead of joining it.
      // Newly added files are never auto-selected/auto-opened — the large
      // viewer only opens when the user explicitly clicks a file card.
      const added: DraftAttachment[] = [];
      for (const file of list) {
        const validation = validateDocumentOrImage(file.type, file.size, file.name);
        if (!validation.valid) {
          toast.error(`${file.name}: ${validation.error}`);
          continue;
        }
        let dataUrl: string;
        try {
          dataUrl = await fileToDataUrl(file);
        } catch {
          toast.error(`${file.name}: Upload failed — Retry.`);
          continue;
        }
        added.push({ fileName: file.name, mimeType: file.type, sizeBytes: file.size, dataUrl });
      }
      if (added.length > 0) onAttachmentsChange([...attachments, ...added]);
    } finally {
      setUploading(false);
    }
  }

  function handleRemove(target: DraftAttachment) {
    onAttachmentsChange(attachments.filter((a) => a !== target));
    if (selected === target) onSelect(null);
  }

  const filtered = attachments.filter((a) => a.fileName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">
          {attachments.length} file{attachments.length === 1 ? "" : "s"} attached
        </p>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <Plus className="h-3 w-3" /> Add Files
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files ?? []);
            e.target.value = "";
          }}
        />
      </div>

      {attachments.length > 0 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files..." className="pl-8 h-8 text-xs" />
        </div>
      )}

      <div
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-3 py-3 text-xs cursor-pointer transition-colors",
          dragOver ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
        )}
      >
        <Paperclip className="h-3.5 w-3.5" />
        {uploading ? "Uploading…" : "Drag & drop files, or click to browse"}
      </div>
      <p className="text-[10px] text-muted-foreground text-center -mt-1.5">
        Supports {SUPPORTED_DOCUMENT_LABEL}, {SUPPORTED_IMAGE_LABEL} · Max {MAX_DOCUMENT_BYTES / (1024 * 1024)}MB per file
      </p>
      <p className="text-[10px] text-muted-foreground/80 text-center -mt-1.5">
        PDF, DOCX, XLS/XLSX, PPTX, TXT, and images preview inline · legacy DOC/PPT show file details only
      </p>

      {attachments.length === 0 ? (
        <EmptyState icon={Paperclip} title="No files attached" description="Add supporting PDFs, docs, or images." />
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No files match &quot;{search}&quot;.</p>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((file, i) => (
            <FileHoverPreview key={file.id ?? `${file.fileName}-${i}`} file={file}>
              <AttachedFileCard
                file={file}
                selected={selected === file}
                onClick={() => onSelect(selected === file ? null : file)}
                onRemove={() => handleRemove(file)}
              />
            </FileHoverPreview>
          ))}
        </div>
      )}
    </div>
  );
}
