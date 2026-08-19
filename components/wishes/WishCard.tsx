import Link from "next/link";
import { ImageOff } from "lucide-react";
import { StatusBadge } from "@/components/portal/status-badge";
import { formatMoney } from "@/lib/invoicing/ui";
import type { ProductWishRecord } from "@/types/wishes";

const STATUS_LABELS: Record<ProductWishRecord["status"], string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

/**
 * Reusable Wish card — deliberately separate from the Shop ProductCard
 * (components/shop/ProductCard.tsx), which is not touched by this feature.
 * Every wish (existing, new, future) renders through this one component.
 * The soft pink glow behind the image is the card's defining visual
 * signature, always present (every card on a Wishes page is a wish), and
 * clipped to the image's own rounded container so it never bleeds past it.
 */
export function WishCard({ wish, href }: { wish: ProductWishRecord; href: string }) {
  const cover = wish.images[0];

  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow duration-300"
    >
      <div className="relative aspect-square overflow-hidden bg-[#fafafa]">
        {/* Soft pink glow — a blurred blob larger than the image itself,
            clipped by this container's overflow-hidden so it never bleeds
            past the card. Sized/blurred to peek out around the product
            photo rather than sit fully hidden behind it. */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[85%] rounded-full blur-3xl pointer-events-none"
          style={{ backgroundColor: "rgba(255, 105, 180, 0.35)" }}
        />
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.dataUrl} alt={wish.name} className="relative w-full h-full object-contain p-10" />
        ) : (
          <div className="relative w-full h-full flex items-center justify-center text-muted-foreground">
            <ImageOff className="w-8 h-8" />
          </div>
        )}
      </div>

      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm text-foreground line-clamp-2 min-w-0">{wish.name || "Untitled Wish"}</h3>
          <StatusBadge status={STATUS_LABELS[wish.status]} />
        </div>
        {wish.category && <p className="text-xs text-muted-foreground truncate">{wish.category}</p>}

        {(wish.targetPrice !== null || wish.targetMoq !== null) && (
          <div className="border-t border-border/60 pt-2 flex items-center gap-3 text-xs text-muted-foreground">
            {wish.targetPrice !== null && <span>Target {formatMoney(wish.targetPrice, wish.currency)}</span>}
            {wish.targetMoq !== null && <span>MOQ {wish.targetMoq} pcs</span>}
          </div>
        )}
      </div>
    </Link>
  );
}
