"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, FileSpreadsheet, FileArchive, File as FileIcon, X, UploadCloud, Loader2, Download } from "lucide-react";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { validateDocument, DOCUMENT_MIME_TYPES } from "@/lib/file-validation";
import { formatFileSize } from "@/lib/supply-chain-ui";
import { uploadMilestoneAttachmentAction, removeMilestoneAttachmentAction } from "@/services/milestone-attachments";
import { cn } from "@/lib/utils";
import type { MilestoneAttachmentEntry } from "@/types/supply-chain";

function iconFor(mimeType: string) {
  if (mimeType.includes("pdf")) return FileText;
  if (mimeType.includes("word")) return FileText;
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return FileSpreadsheet;
  if (mimeType.includes("zip")) return FileArchive;
  return FileIcon;
}

interface TimelineAttachmentsProps {
  milestoneId: string;
  attachments: MilestoneAttachmentEntry[];
  canEdit: boolean;
  onAttachmentsChange: (attachments: MilestoneAttachmentEntry[]) => void;
}

interface PendingUpload {
  id: string;
  fileName: string;
  progress: number;
}

export function TimelineAttachments({ milestoneId, attachments, canEdit, onAttachmentsChange }: TimelineAttachmentsProps) {
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const validation = validateDocument(file.type, file.size);
      if (!validation.valid) {
        toast.error(`${file.name}: ${validation.error}`);
        continue;
      }

      const pendingId = `${file.name}-${Date.now()}`;
      setPending((prev) => [...prev, { id: pendingId, fileName: file.name, progress: 0 }]);

      try {
        const dataUrl = await fileToDataUrl(file, (percent) => {
          setPending((prev) => prev.map((p) => (p.id === pendingId ? { ...p, progress: percent } : p)));
        });

        const result = await uploadMilestoneAttachmentAction(milestoneId, {
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          dataUrl,
        });

        if (!result.success) {
          toast.error(result.error);
        } else {
          onAttachmentsChange([
            {
              id: result.data.id,
              fileName: file.name,
              mimeType: file.type,
              sizeBytes: file.size,
              dataUrl,
              uploadedBy: { id: "", name: "You", email: "", role: "BUYER", avatar: null, companyName: null },
              createdAt: new Date().toISOString(),
            },
            ...attachments,
          ]);
        }
      } catch {
        toast.error(`${file.name}: upload failed.`);
      } finally {
        setPending((prev) => prev.filter((p) => p.id !== pendingId));
      }
    }
  }

  async function handleRemove(id: string) {
    const result = await removeMilestoneAttachmentAction(id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    onAttachmentsChange(attachments.filter((a) => a.id !== id));
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-colors",
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"
          )}
        >
          <UploadCloud className="h-5 w-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            <span className="text-primary font-medium">Click to upload</span> or drag and drop files
          </p>
          <p className="text-[10px] text-muted-foreground/70">PDF, Word, Excel, or ZIP up to 10MB</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={DOCUMENT_MIME_TYPES.join(",")}
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>
      )}

      {pending.map((p) => (
        <div key={p.id} className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
          <span className="text-xs text-foreground truncate flex-1">{p.fileName}</span>
          <span className="text-[10px] text-muted-foreground">{p.progress}%</span>
        </div>
      ))}

      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map((a) => {
            const Icon = iconFor(a.mimeType);
            return (
              <div key={a.id} className="flex items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground truncate">{a.fileName}</p>
                  <p className="text-[10px] text-muted-foreground">{formatFileSize(a.sizeBytes)}</p>
                </div>
                <a
                  href={a.dataUrl}
                  download={a.fileName}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
                  aria-label={`Download ${a.fileName}`}
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleRemove(a.id)}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
                    aria-label={`Remove ${a.fileName}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {attachments.length === 0 && pending.length === 0 && (
        <p className="text-center text-[11px] text-muted-foreground/60 py-2">No documents attached yet.</p>
      )}
    </div>
  );
}
