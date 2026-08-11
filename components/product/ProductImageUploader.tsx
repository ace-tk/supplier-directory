"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Star, X } from "lucide-react";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { validateImage } from "@/lib/file-validation";
import { addRowImageAction, removeRowImageAction, reorderRowImagesAction } from "@/services/catalog";
import { cn } from "@/lib/utils";
import type { CatalogRowImageEntry } from "@/types/catalog";

export interface PendingImage {
  dataUrl: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Reuses Catalog's existing image storage exactly as-is — CatalogRowImage
 * (base64 dataUrl persisted per row via addRowImageAction/removeRowImageAction),
 * the same mechanism CatalogItemForm already uses — just with a larger
 * cover preview + thumbnail rail. Before the row exists yet (Add Product),
 * images are held as `pendingImages` locally and uploaded right after the
 * row is created, mirroring CatalogItemForm's create flow.
 */
export function ProductImageUploader({
  rowId,
  images,
  onImagesChange,
  pendingImages,
  onPendingImagesChange,
}: {
  rowId: string | null;
  images: CatalogRowImageEntry[];
  onImagesChange: (images: CatalogRowImageEntry[]) => void;
  pendingImages: PendingImage[];
  onPendingImagesChange: (images: PendingImage[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cover = images[0] ?? null;
  const coverPending = images.length === 0 ? (pendingImages[0] ?? null) : null;

  async function handleAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    const v = validateImage(file.type, file.size);
    if (!v.valid) {
      setError(v.error!);
      toast.error(v.error);
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      if (rowId) {
        const result = await addRowImageAction(rowId, { dataUrl, mimeType: file.type, sizeBytes: file.size });
        if (!result.success) {
          setError(result.error);
          toast.error(result.error);
          return;
        }
        onImagesChange([...images, result.data]);
      } else {
        onPendingImagesChange([...pendingImages, { dataUrl, mimeType: file.type, sizeBytes: file.size }]);
      }
    } catch {
      setError("Couldn't read that image. Try a different file.");
      toast.error("Couldn't read that image. Try a different file.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(index: number) {
    if (images.length > 0) {
      const image = images[index];
      const result = await removeRowImageAction(image.id);
      if (!result.success) return toast.error(result.error);
      onImagesChange(images.filter((_, i) => i !== index));
    } else {
      onPendingImagesChange(pendingImages.filter((_, i) => i !== index));
    }
  }

  async function handleSetCover(index: number) {
    if (index === 0) return;
    if (images.length > 0 && rowId) {
      const reordered = [images[index], ...images.filter((_, i) => i !== index)];
      onImagesChange(reordered);
      const result = await reorderRowImagesAction(rowId, reordered.map((i) => i.id));
      if (!result.success) {
        toast.error(result.error);
        onImagesChange(images);
      }
    } else {
      onPendingImagesChange([pendingImages[index], ...pendingImages.filter((_, i) => i !== index)]);
    }
  }

  const allThumbs = images.length > 0 ? images : pendingImages;

  return (
    <div className="space-y-3">
      {/* Large cover preview */}
      <div className="aspect-square w-full rounded-xl border border-border bg-muted overflow-hidden relative">
        {cover || coverPending ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={(cover ?? coverPending)!.dataUrl} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          >
            {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Plus className="h-6 w-6" />}
            <span className="text-xs font-medium">{uploading ? "Uploading…" : "Upload cover image"}</span>
          </button>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Thumbnail rail */}
      <div className="grid grid-cols-5 gap-2">
        {allThumbs.map((img, i) => (
          <div key={"id" in img ? img.id : i} className="relative group aspect-square rounded-lg overflow-hidden bg-muted border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.dataUrl} alt="" className="w-full h-full object-cover" />
            {i === 0 && (
              <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-black/70 text-white text-[9px] px-1 py-0.5">
                <Star className="h-2.5 w-2.5 fill-current" /> Cover
              </span>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-between p-1">
              {i !== 0 && (
                <button
                  type="button"
                  onClick={() => handleSetCover(i)}
                  className="flex items-center justify-center w-5 h-5 rounded-full bg-black/60 text-white hover:bg-primary"
                  aria-label="Set as cover"
                  title="Set as cover"
                >
                  <Star className="h-3 w-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="flex items-center justify-center w-5 h-5 rounded-full bg-black/60 text-white hover:bg-destructive ml-auto"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors",
            uploading && "opacity-60"
          )}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleAdd} />
      <p className="text-[11px] text-muted-foreground">JPEG, PNG, WEBP, or GIF, up to 5MB. Click the star on a thumbnail to make it the cover image.</p>
    </div>
  );
}
