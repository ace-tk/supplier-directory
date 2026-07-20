"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Check, X, Loader2, FileText, Image, File,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type PortalFormState, DOCUMENT_TYPES } from "@/types/portal";
import { toast } from "sonner";

interface DocumentUploaderProps {
  state: PortalFormState;
  onChange: (partial: Partial<PortalFormState>) => void;
}

function fileIcon(name: string) {
  if (/\.(jpg|jpeg|png|webp|gif)$/i.test(name)) return Image;
  if (/\.pdf$/i.test(name)) return FileText;
  return File;
}

function formatSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentUploader({ state, onChange }: DocumentUploaderProps) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  async function handleFile(docType: string, accept: string, file: File) {
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) { toast.error("File too large (max 10MB)"); return; }

    setUploading((u) => ({ ...u, [docType]: true }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/supplier-portal/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json() as { url: string; name: string; size: number };

      onChange({
        documents: {
          ...state.documents,
          [docType]: { docType, fileName: data.name, fileUrl: data.url, fileSize: data.size },
        },
        isDirty: true,
      });
      toast.success(`${DOCUMENT_TYPES.find((d) => d.key === docType)?.label ?? docType} uploaded`);
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading((u) => ({ ...u, [docType]: false }));
    }
    void accept;
  }

  function remove(docType: string) {
    const next = { ...state.documents };
    delete next[docType];
    onChange({ documents: next, isDirty: true });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload your business documents. All files are stored securely and only visible to verified buyers.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {DOCUMENT_TYPES.map(({ key, label, accept, icon }, i) => {
          const doc = state.documents[key];
          const isUploading = uploading[key];
          const uploaded = !!doc && !isUploading;
          const IconComp = doc ? fileIcon(doc.fileName) : Upload;

          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "relative rounded-xl border-2 p-4 transition-all duration-200",
                uploaded
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-border bg-card hover:border-primary/40"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0",
                    uploaded ? "bg-emerald-500/10" : "bg-muted"
                  )}
                >
                  {isUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : uploaded ? (
                    <IconComp className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <span>{icon}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      {uploaded && doc ? (
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {doc.fileName} {doc.fileSize ? `· ${formatSize(doc.fileSize)}` : ""}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {accept.includes("pdf") && accept.includes("image")
                            ? "PDF or image"
                            : accept.includes("pdf")
                            ? "PDF only"
                            : "Image"}
                        </p>
                      )}
                    </div>
                    {uploaded && (
                      <button
                        type="button"
                        onClick={() => remove(key)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    {uploaded ? (
                      <AnimatePresence>
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
                        >
                          <Check className="h-3 w-3" /> Uploaded
                        </motion.span>
                      </AnimatePresence>
                    ) : (
                      <button
                        type="button"
                        disabled={isUploading}
                        onClick={() => inputRefs.current[key]?.click()}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isUploading ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</>
                        ) : (
                          <><Upload className="h-3 w-3" /> Upload</>
                        )}
                      </button>
                    )}
                    {uploaded && (
                      <button
                        type="button"
                        onClick={() => inputRefs.current[key]?.click()}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Replace
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <input
                ref={(el) => { inputRefs.current[key] = el; }}
                type="file"
                accept={accept}
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(key, accept, f);
                  e.target.value = "";
                }}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
