"use client";

import { useRef, useState } from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { toast } from "sonner";
import { FileText, FileSpreadsheet, FileArchive, File as FileIcon, X, UploadCloud, Loader2 } from "lucide-react";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { validateDocument, DOCUMENT_MIME_TYPES } from "@/lib/file-validation";
import { formatFileSize } from "@/lib/freelancer-ui";
import { cn } from "@/lib/utils";
import type { CreateProjectFormValues } from "@/lib/validations/project";

function iconFor(mimeType: string) {
  if (mimeType.includes("pdf")) return FileText;
  if (mimeType.includes("word")) return FileText;
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return FileSpreadsheet;
  if (mimeType.includes("zip")) return FileArchive;
  return FileIcon;
}

export function DocumentsSection() {
  const { control } = useFormContext<CreateProjectFormValues>();
  const documents = useFieldArray({ control, name: "documents" });
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | File[]) {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const validation = validateDocument(file.type, file.size);
        if (!validation.valid) {
          toast.error(`${file.name}: ${validation.error}`);
          continue;
        }
        const dataUrl = await fileToDataUrl(file);
        documents.append({ id: crypto.randomUUID(), fileName: file.name, mimeType: file.type, sizeBytes: file.size, dataUrl });
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
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
          "flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"
        )}
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
        ) : (
          <UploadCloud className="h-5 w-5 text-muted-foreground" />
        )}
        <p className="text-xs text-muted-foreground">
          <span className="text-primary font-medium">Click to upload</span> or drag and drop files
        </p>
        <p className="text-[10px] text-muted-foreground/70">PDF, DOC, DOCX, XLS, or ZIP up to 10MB each</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={DOCUMENT_MIME_TYPES.join(",")}
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {documents.fields.length > 0 && (
        <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
          {documents.fields.map((field, index) => {
            const Icon = iconFor(field.mimeType);
            return (
              <div key={field.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground truncate">{field.fileName}</p>
                  <p className="text-[10px] text-muted-foreground">{formatFileSize(field.sizeBytes)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => documents.remove(index)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  aria-label="Remove document"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
