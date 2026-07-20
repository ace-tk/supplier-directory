"use client";

import { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type UploadedFile } from "@/types/portal";
import { toast } from "sonner";

interface ImageUploaderProps {
  images: UploadedFile[];
  onChange: (images: UploadedFile[]) => void;
  maxImages?: number;
}

async function uploadFile(file: File): Promise<UploadedFile> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/supplier-portal/upload", { method: "POST", body: fd });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json() as { url: string; name: string; size: number };
  return { name: data.name, url: data.url, size: data.size };
}

export function ImageUploader({ images, onChange, maxImages = 8 }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draggingOver, setDraggingOver] = useState(false);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!fileArr.length) return;
    const remaining = maxImages - images.length;
    const toUpload = fileArr.slice(0, remaining);
    if (toUpload.length === 0) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    // Add placeholders
    const placeholders: UploadedFile[] = toUpload.map((f) => ({
      name: f.name,
      url: "",
      preview: URL.createObjectURL(f),
      uploading: true,
    }));
    onChange([...images, ...placeholders]);

    // Upload in parallel
    const results = await Promise.allSettled(toUpload.map((f) => uploadFile(f)));
    const updated = [...images];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        updated.push({ ...r.value, preview: placeholders[i].preview });
      } else {
        toast.error(`Failed to upload ${toUpload[i].name}`);
      }
    });
    onChange(updated);
  }, [images, maxImages, onChange]);

  const remove = (idx: number) => {
    const next = images.filter((_, i) => i !== idx);
    onChange(next);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...images];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      {images.length < maxImages && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
          onDragLeave={() => setDraggingOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDraggingOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all duration-200",
            draggingOver
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          )}
        >
          <motion.div
            animate={draggingOver ? { scale: 1.1, y: -2 } : { scale: 1, y: 0 }}
            className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center"
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
          </motion.div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {draggingOver ? "Drop images here" : "Drag & drop images"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              or click to browse · PNG, JPG, WebP · max 10MB each
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>
      )}

      {/* Thumbnails */}
      <AnimatePresence mode="popLayout">
        {images.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-3 sm:grid-cols-4 gap-2"
          >
            {images.map((img, idx) => (
              <motion.div
                key={img.preview ?? img.url}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.preview ?? img.url}
                  alt={img.name}
                  className="w-full h-full object-cover"
                />
                {img.uploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  </div>
                )}
                {!img.uploading && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      className="w-6 h-6 rounded bg-white/90 flex items-center justify-center disabled:opacity-30"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="w-6 h-6 rounded bg-red-500 text-white flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, 1)}
                      disabled={idx === images.length - 1}
                      className="w-6 h-6 rounded bg-white/90 flex items-center justify-center disabled:opacity-30"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {idx === 0 && !img.uploading && (
                  <span className="absolute top-1 left-1 text-[10px] font-semibold bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                    Main
                  </span>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {images.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {images.length}/{maxImages} images · Hover a thumbnail to reorder or remove
        </p>
      )}
    </div>
  );
}
