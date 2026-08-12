"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Paperclip } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { AttachedFileCard } from "./AttachedFileCard";
import { FileHoverPreview } from "./FileHoverPreview";
import { CollapsibleFilePreview } from "./CollapsibleFilePreview";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { validateImage, validateDocument } from "@/lib/file-validation";
import { cn } from "@/lib/utils";
import type { DraftAttachment } from "@/types/content";

export function AttachedFilesPanel({
  attachments,
  onAttachmentsChange,
}: {
  attachments: DraftAttachment[];
  onAttachmentsChange: (next: DraftAttachment[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DraftAttachment | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    try {
      for (const file of list) {
        const okDoc = validateDocument(file.type, file.size).valid;
        const okImg = validateImage(file.type, file.size).valid;
        if (!okDoc && !okImg) {
          toast.error(`${file.name}: unsupported file type or too large.`);
          continue;
        }
        const dataUrl = await fileToDataUrl(file);
        onAttachmentsChange([...attachments, { fileName: file.name, mimeType: file.type, sizeBytes: file.size, dataUrl }]);
      }
    } finally {
      setUploading(false);
    }
  }

  function handleRemove(target: DraftAttachment) {
    onAttachmentsChange(attachments.filter((a) => a !== target));
    if (selected === target) setSelected(null);
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

      {selected && <CollapsibleFilePreview key={selected.id ?? selected.fileName} file={selected} />}

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
                onClick={() => setSelected((s) => (s === file ? null : file))}
                onRemove={() => handleRemove(file)}
              />
            </FileHoverPreview>
          ))}
        </div>
      )}
    </div>
  );
}
