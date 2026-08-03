"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Film, X, UploadCloud, Loader2 } from "lucide-react";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { validateImage, validateVideo, IMAGE_MIME_TYPES, VIDEO_MIME_TYPES } from "@/lib/file-validation";
import { formatFileSize } from "@/lib/supply-chain-ui";
import { uploadMilestoneMediaAction, removeMilestoneMediaAction } from "@/services/milestone-media";
import { cn } from "@/lib/utils";
import type { MilestoneMediaEntry } from "@/types/supply-chain";

interface TimelineMediaProps {
  milestoneId: string;
  media: MilestoneMediaEntry[];
  canEdit: boolean;
  onMediaChange: (media: MilestoneMediaEntry[]) => void;
}

interface PendingUpload {
  id: string;
  fileName: string;
  progress: number;
}

export function TimelineMedia({ milestoneId, media, canEdit, onMediaChange }: TimelineMediaProps) {
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const isImage = IMAGE_MIME_TYPES.includes(file.type);
      const isVideo = VIDEO_MIME_TYPES.includes(file.type);
      if (!isImage && !isVideo) {
        toast.error(`${file.name}: unsupported file type.`);
        continue;
      }

      const validation = isImage ? validateImage(file.type, file.size) : validateVideo(file.type, file.size);
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

        const result = await uploadMilestoneMediaAction(milestoneId, {
          kind: isImage ? "IMAGE" : "VIDEO",
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          dataUrl,
        });

        if (!result.success) {
          toast.error(result.error);
        } else {
          onMediaChange([
            {
              id: result.data.id,
              kind: isImage ? "IMAGE" : "VIDEO",
              fileName: file.name,
              mimeType: file.type,
              sizeBytes: file.size,
              dataUrl,
              uploadedBy: { id: "", name: "You", email: "", role: "BUYER", avatar: null, companyName: null },
              createdAt: new Date().toISOString(),
            },
            ...media,
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
    const result = await removeMilestoneMediaAction(id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    onMediaChange(media.filter((m) => m.id !== id));
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
            <span className="text-primary font-medium">Click to upload</span> or drag and drop images/videos
          </p>
          <p className="text-[10px] text-muted-foreground/70">JPEG, PNG, WEBP, GIF up to 5MB · MP4, WEBM, MOV up to 15MB</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={[...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES].join(",")}
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

      {media.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {media.map((m) => (
            <div key={m.id} className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted">
              {m.kind === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element -- base64 data URLs aren't compatible with next/image optimization
                <img src={m.dataUrl} alt={m.fileName} className="w-full h-full object-cover" />
              ) : (
                <video src={m.dataUrl} className="w-full h-full object-cover" muted />
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-end p-1.5 opacity-0 group-hover:opacity-100">
                <span className="flex items-center gap-1 text-[9px] text-white truncate flex-1">
                  {m.kind === "IMAGE" ? <ImagePlus className="h-2.5 w-2.5 shrink-0" /> : <Film className="h-2.5 w-2.5 shrink-0" />}
                  {formatFileSize(m.sizeBytes)}
                </span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(m.id);
                    }}
                    className="p-1 rounded-full bg-black/60 text-white hover:bg-black/80 shrink-0"
                    aria-label="Remove file"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {media.length === 0 && pending.length === 0 && (
        <p className="text-center text-[11px] text-muted-foreground/60 py-2">No images or videos yet.</p>
      )}
    </div>
  );
}
