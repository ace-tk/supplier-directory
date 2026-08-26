"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { X, Plus, UploadCloud } from "lucide-react";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { validateImage } from "@/lib/file-validation";
import { cn } from "@/lib/utils";

const MAX_REFERENCES = 4;

export function ReferenceUploader({
  images,
  onChange,
}: {
  images: string[];
  onChange: (images: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function addFiles(files: FileList | File[]) {
    const room = MAX_REFERENCES - images.length;
    if (room <= 0) {
      toast.error(`You can upload up to ${MAX_REFERENCES} reference images.`);
      return;
    }
    const list = Array.from(files).slice(0, room);
    const next: string[] = [];
    for (const file of list) {
      const check = validateImage(file.type, file.size, file.name);
      if (!check.valid) {
        toast.error(check.error);
        continue;
      }
      next.push(await fileToDataUrl(file));
    }
    if (next.length) onChange([...images, ...next]);
  }

  function removeAt(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          References {images.length} / {MAX_REFERENCES}
        </p>
      </div>

      {images.length === 0 ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors",
            dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/40 hover:bg-muted/60"
          )}
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-card border border-border">
            <UploadCloud className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Drop reference images</p>
          <p className="text-xs text-muted-foreground">Up to {MAX_REFERENCES} · PNG, JPG, WEBP, or GIF · Max 5MB each</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-muted/40 p-3">
          {images.map((src, i) => (
            <div key={i} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-border shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Reference ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`Remove reference ${i + 1}`}
                className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          {images.length < MAX_REFERENCES && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-0.5 w-16 h-16 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="text-[9px] font-medium">Add</span>
            </button>
          )}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mt-2">
        Tip: the first image becomes the tile itself — only its seam is repaired, everything else is preserved exactly. Extra images just help the AI match your print&apos;s style.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
