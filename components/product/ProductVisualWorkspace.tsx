"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Star, X, Tag } from "lucide-react";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { validateImage } from "@/lib/file-validation";
import { addRowImageAction, removeRowImageAction, reorderRowImagesAction, updateRowImageViewAction } from "@/services/catalog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { CatalogRowImageEntry, ProductImageView } from "@/types/catalog";

export interface PendingImage {
  dataUrl: string;
  mimeType: string;
  sizeBytes: number;
  view: ProductImageView;
}

const VIEW_TABS: { value: ProductImageView; label: string }[] = [
  { value: "FRONT", label: "Front" },
  { value: "BACK", label: "Back" },
  { value: "SIDE", label: "Side View" },
  { value: "WASH_CARE", label: "Wash Care Label" },
  { value: "OTHER", label: "Other" },
];

const VIEW_LABEL: Record<ProductImageView, string> = Object.fromEntries(VIEW_TABS.map((t) => [t.value, t.label])) as Record<
  ProductImageView,
  string
>;

export interface ProductMetadataItem {
  label: string;
  value: string;
}

/**
 * The Product module's right-side visual workspace — a large main preview
 * with view tabs (Front/Back/Side/Wash Care/Other, a real persisted
 * CatalogRowImage.view tag) and a thumbnail rail below, plus compact
 * metadata cards summarizing the product's real current field values.
 *
 * Reuses Catalog's existing image storage exactly as-is — the same
 * addRowImageAction/removeRowImageAction/reorderRowImagesAction calls
 * ProductImageUploader used, operating on the SAME images/pendingImages
 * state the caller (ProductForm) already owns. Before the row exists yet
 * (Add Product), images are held as `pendingImages` locally and uploaded
 * right after the row is created.
 */
export function ProductVisualWorkspace({
  rowId,
  images,
  onImagesChange,
  pendingImages,
  onPendingImagesChange,
  metadata,
}: {
  rowId: string | null;
  images: CatalogRowImageEntry[];
  onImagesChange: (images: CatalogRowImageEntry[]) => void;
  pendingImages: PendingImage[];
  onPendingImagesChange: (images: PendingImage[]) => void;
  metadata: ProductMetadataItem[];
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ProductImageView>("FRONT");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allThumbs: (CatalogRowImageEntry | (PendingImage & { id: string }))[] =
    images.length > 0 ? images : pendingImages.map((p, i) => ({ ...p, id: `pending-${i}` }));

  // The selected thumbnail wins if still present; otherwise fall back to
  // the first image matching the active tab, then the first image overall.
  // Clicking a thumbnail sets both selectedId and activeView together (see
  // selectThumb below) so the tab bar and the large preview always agree —
  // no effect needed to keep them in sync.
  const selected =
    allThumbs.find((t) => t.id === selectedId) ?? allThumbs.find((t) => t.view === activeView) ?? allThumbs[0] ?? null;

  function selectThumb(thumb: CatalogRowImageEntry | (PendingImage & { id: string })) {
    setSelectedId(thumb.id);
    setActiveView(thumb.view);
  }

  function selectTab(view: ProductImageView) {
    setActiveView(view);
    setSelectedId(null);
  }

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
        const result = await addRowImageAction(rowId, { dataUrl, mimeType: file.type, sizeBytes: file.size, view: activeView });
        if (!result.success) {
          setError(result.error);
          toast.error(result.error);
          return;
        }
        onImagesChange([...images, result.data]);
        setSelectedId(result.data.id);
      } else {
        onPendingImagesChange([...pendingImages, { dataUrl, mimeType: file.type, sizeBytes: file.size, view: activeView }]);
      }
    } catch {
      setError("Couldn't read that image. Try a different file.");
      toast.error("Couldn't read that image. Try a different file.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(id: string) {
    if (images.length > 0) {
      const result = await removeRowImageAction(id);
      if (!result.success) return toast.error(result.error);
      onImagesChange(images.filter((i) => i.id !== id));
    } else {
      const index = Number(id.replace("pending-", ""));
      onPendingImagesChange(pendingImages.filter((_, i) => i !== index));
    }
    if (selectedId === id) setSelectedId(null);
  }

  async function handleSetCover(id: string) {
    if (images.length > 0 && rowId) {
      const index = images.findIndex((i) => i.id === id);
      if (index <= 0) return;
      const reordered = [images[index], ...images.filter((_, i) => i !== index)];
      onImagesChange(reordered);
      const result = await reorderRowImagesAction(rowId, reordered.map((i) => i.id));
      if (!result.success) {
        toast.error(result.error);
        onImagesChange(images);
      }
    } else {
      const index = Number(id.replace("pending-", ""));
      if (index <= 0) return;
      onPendingImagesChange([pendingImages[index], ...pendingImages.filter((_, i) => i !== index)]);
    }
  }

  async function handleSetView(id: string, view: ProductImageView) {
    if (images.length > 0 && rowId) {
      const result = await updateRowImageViewAction(id, view);
      if (!result.success) return toast.error(result.error);
      onImagesChange(images.map((i) => (i.id === id ? { ...i, view } : i)));
    } else {
      const index = Number(id.replace("pending-", ""));
      onPendingImagesChange(pendingImages.map((p, i) => (i === index ? { ...p, view } : p)));
    }
  }

  return (
    <div className="space-y-4">
      {/* View tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => selectTab(tab.value)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
              activeView === tab.value
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Large main preview */}
      <div className="w-full h-[380px] rounded-xl border border-border bg-muted/40 overflow-hidden relative">
        {selected ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={selected.dataUrl} alt="Product" className="w-full h-full object-contain" />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full h-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
          >
            {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Plus className="h-6 w-6" />}
            <span className="text-xs font-medium">{uploading ? "Uploading…" : `Upload ${VIEW_LABEL[activeView].toLowerCase()} image`}</span>
          </button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleAdd} />

      {/* Thumbnail rail */}
      <div className="grid grid-cols-5 gap-2">
        {allThumbs.map((img, i) => (
          <div
            key={img.id}
            onClick={() => selectThumb(img)}
            className={cn(
              "relative group aspect-square rounded-lg overflow-hidden bg-muted border cursor-pointer",
              selected?.id === img.id ? "border-primary ring-1 ring-primary" : "border-border"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.dataUrl} alt="" className="w-full h-full object-cover" />
            {i === 0 && (
              <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-black/70 text-white text-[9px] px-1 py-0.5">
                <Star className="h-2.5 w-2.5 fill-current" /> Cover
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-1 left-1 flex items-center gap-0.5 rounded bg-black/70 text-white text-[9px] px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                }
              >
                <Tag className="h-2.5 w-2.5" /> {VIEW_LABEL[img.view]}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                {VIEW_TABS.map((tab) => (
                  <DropdownMenuItem key={tab.value} onClick={() => handleSetView(img.id, tab.value)}>
                    {tab.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-1">
              {i !== 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSetCover(img.id);
                  }}
                  className="flex items-center justify-center w-5 h-5 rounded-full bg-black/60 text-white hover:bg-primary mr-1"
                  aria-label="Set as cover"
                  title="Set as cover"
                >
                  <Star className="h-3 w-3" />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(img.id);
                }}
                className="flex items-center justify-center w-5 h-5 rounded-full bg-black/60 text-white hover:bg-destructive"
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
      <p className="text-[11px] text-muted-foreground">
        JPEG, PNG, WEBP, or GIF, up to 5MB. Click the star on a thumbnail to make it the cover image, or the tag to reclassify its view.
      </p>

      {/* Real product metadata — only fields that actually exist */}
      {metadata.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-border">
          {metadata.map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-muted/30 px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
              <p className="text-xs font-medium text-foreground truncate">{item.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
