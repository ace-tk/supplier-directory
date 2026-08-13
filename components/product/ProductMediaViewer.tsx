"use client";

import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Bookmark, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CatalogRowImageEntry, ProductImageView } from "@/types/catalog";

// Device-local "saved" toggle — real, user-controlled state (not a fake
// analytics counter), just not synced across devices since no server-side
// saved-items model exists for Product. Read via useSyncExternalStore (not
// useState+useEffect) so the initial client render always matches the
// server-rendered HTML — no hydration mismatch — and a same-tab toggle is
// reflected immediately via the custom event below (localStorage's own
// `storage` event only fires in *other* tabs).
const SAVED_EVENT = "product-saved-change";

function savedKey(productId: string) {
  return `product-saved-${productId}`;
}
function subscribeToSaved(onChange: () => void) {
  window.addEventListener(SAVED_EVENT, onChange);
  return () => window.removeEventListener(SAVED_EVENT, onChange);
}
function getSavedServerSnapshot() {
  return false;
}

const VIEW_LABEL: Record<ProductImageView, string> = {
  FRONT: "Front",
  BACK: "Back",
  SIDE: "Side View",
  WASH_CARE: "Wash Care Label",
  OTHER: "Other",
};

// A fixed, sensible tab order — actual visibility is still gated by
// whether the product has an image for that view (see availableViews
// below), so a product with only "Other" images never shows empty
// Front/Back/Side tabs.
const VIEW_ORDER: ProductImageView[] = ["FRONT", "BACK", "SIDE", "WASH_CARE", "OTHER"];

/**
 * Read-only large media viewer for Product Detail — the same real,
 * persisted CatalogRowImage records the Product Visual Workspace manages,
 * just without any upload/edit controls. Media tabs only ever show for
 * views the product genuinely has an image for; there is no "Video" tab
 * because Product images don't support video uploads (no fake tab for an
 * unsupported asset type).
 */
export function ProductMediaViewer({ productId, productName, images }: { productId: string; productName: string; images: CatalogRowImageEntry[] }) {
  const availableViews = VIEW_ORDER.filter((v) => images.some((img) => img.view === v));
  const [activeView, setActiveView] = useState<ProductImageView | null>(availableViews[0] ?? null);
  const saved = useSyncExternalStore(
    subscribeToSaved,
    () => window.localStorage.getItem(savedKey(productId)) === "1",
    getSavedServerSnapshot
  );

  function toggleSaved() {
    const next = !saved;
    window.localStorage.setItem(savedKey(productId), next ? "1" : "0");
    window.dispatchEvent(new Event(SAVED_EVENT));
    toast.success(next ? "Saved to this device" : "Removed from saved");
  }

  function handleShare() {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => toast.success("Link copied to clipboard"))
      .catch(() => toast.error("Couldn't copy the link"));
  }

  const shown = activeView ? images.filter((img) => img.view === activeView) : images;
  const cover = shown[0] ?? images[0] ?? null;

  return (
    <div className="space-y-3">
      {availableViews.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {availableViews.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setActiveView(v)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                activeView === v
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
      )}

      <div className="w-full h-[420px] rounded-xl border border-border bg-muted/40 overflow-hidden relative">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.dataUrl} alt={productName} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">No images uploaded yet</div>
        )}
      </div>

      {shown.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto">
          {shown.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveView(img.view)}
              className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.dataUrl} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={toggleSaved}>
          <Bookmark className={cn("h-3.5 w-3.5", saved && "fill-current")} /> {saved ? "Saved" : "Save"}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleShare}>
          <Share2 className="h-3.5 w-3.5" /> Share
        </Button>
      </div>
    </div>
  );
}
