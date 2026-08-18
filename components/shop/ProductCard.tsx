"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  Download,
  Share2,
  Heart,
  MessageCircle,
  Pencil,
  Factory,
  Loader2,
  MoreHorizontal,
  ShoppingCart,
  Eye,
  Video,
  TrendingUp,
  Users,
} from "lucide-react";
import { Product } from "@/types/product";
import { Supplier } from "@/types/supplier";
import { getProductTags, getTagColor } from "@/lib/product-tags";
import { downloadDetails, shareDetails } from "@/lib/card-actions";
import { createCatalogRowFromShopProductAction } from "@/services/shop";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  formatCompactCount,
  getProductKindLabel,
  getShopMediaOptions,
  parseColorsFromSpecifications,
  parseSizesFromSpecifications,
  productBasePath,
  whatsappHref,
  type ShopMediaKind,
} from "@/lib/shop-card-data";

export function ProductCard({
  product,
  onClick,
  onViewSupplier,
  onRequestVideo,
  onCounterOffer,
  isSaved,
  onToggleSave,
}: {
  product: Product;
  onClick: (product: Product) => void;
  onViewSupplier: (supplier: Supplier) => void;
  /** Kept in the prop type so MasonryGrid's existing call sites still
   * type-check unchanged — not used here since no real per-product video
   * exists (see getShopMediaOptions doc comment). Request Video below is
   * the honest substitute. */
  onWatchVideo: (product: Product) => void;
  onRequestVideo: (product: Product) => void;
  onCounterOffer: (product: Product, initialStep: "terms" | "offer") => void;
  isSaved: boolean;
  onToggleSave: (product: Product) => void;
}) {
  const router = useRouter();
  const session = useSession();
  const [pendingWorkflow, setPendingWorkflow] = useState<"design" | "manufacture" | null>(null);
  const [activeKind, setActiveKind] = useState<ShopMediaKind | null>(null);

  const tags = getProductTags(product);
  const supplier = product.supplier;
  const kindLabel = getProductKindLabel(product.name);
  const sizes = parseSizesFromSpecifications(product.specifications);
  const colors = parseColorsFromSpecifications(product.specifications);
  const media = getShopMediaOptions(product);
  const activeMedia = media.find((m) => m.kind === activeKind) ?? media[0];
  const basePath = productBasePath(session?.role);

  function requireAuth(reason: string, action: () => void) {
    if (!session) {
      const returnUrl = `/shop?openRequestVideo=${product.id}`;
      router.push(`/signup?from=${encodeURIComponent(returnUrl)}&reason=${reason}`);
      return;
    }
    action();
  }

  function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    downloadDetails({
      fileName: `${product.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`,
      title: product.name,
      lines: [
        { label: "Product Name", value: product.name },
        { label: "Supplier Name", value: supplier?.companyName ?? "N/A" },
        { label: "Supplier Location", value: supplier ? `${supplier.city}, ${supplier.country}` : "N/A" },
        { label: "MOQ", value: product.moq ?? "N/A" },
        { label: "Price Range", value: product.priceRange ?? "N/A" },
        { label: "Tags", value: tags.join(", ") || "N/A" },
        {
          label: "Contact",
          value: supplier?.phone || supplier?.email || supplier?.whatsapp || "Not available",
        },
      ],
    });
  }

  function handleShare(e: React.MouseEvent) {
    e.stopPropagation();
    shareDetails({
      title: product.name,
      text: `${product.name} from ${supplier?.companyName ?? "a verified supplier"} — ${product.priceRange ?? ""}`,
      url: typeof window !== "undefined" ? `${window.location.origin}/shop?productId=${product.id}` : `/shop?productId=${product.id}`,
    });
  }

  function handleSaveClick(e: React.MouseEvent) {
    e.stopPropagation();
    requireAuth("save", () => onToggleSave(product));
  }

  function handleRequestVideoClick(e: React.MouseEvent) {
    e.stopPropagation();
    requireAuth("video", () => onRequestVideo(product));
  }

  function handleViewOfferClick(e: React.MouseEvent) {
    e.stopPropagation();
    onCounterOffer(product, "terms");
  }

  function handleCounterOfferClick(e: React.MouseEvent) {
    e.stopPropagation();
    requireAuth("offer", () => onCounterOffer(product, "offer"));
  }

  async function handleWorkflowClick(e: React.MouseEvent, workflow: "design" | "manufacture") {
    e.stopPropagation();
    requireAuth(workflow, async () => {
      if (pendingWorkflow) return;
      setPendingWorkflow(workflow);
      try {
        const result = await createCatalogRowFromShopProductAction(product.id);
        if (!result.success) return;
        router.push(`${basePath}/${result.data.rowId}/${workflow}`);
      } finally {
        setPendingWorkflow(null);
      }
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      className="group relative break-inside-avoid mb-6 rounded-2xl overflow-hidden bg-[#f7f6f3] border border-black/8 shadow-sm hover:shadow-md transition-shadow duration-300 text-neutral-900"
    >
      {/* Header: product name + Add to Cart + 3-dot menu */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-1">
        <h3
          className="font-bold text-[17px] leading-snug line-clamp-2 cursor-pointer min-w-0"
          onClick={() => onClick(product)}
        >
          {product.name}
        </h3>
        <div className="flex items-center gap-1 shrink-0">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-1.5 text-[10px] font-semibold text-white opacity-40 cursor-not-allowed"
                  aria-label="Add to cart unavailable"
                />
              }
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add to Cart</span>
            </TooltipTrigger>
            <TooltipContent>Cart is not available in SupplyBase yet</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label="Product actions" onClick={(e) => e.stopPropagation()} />}
            >
              <MoreHorizontal className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onClick(product)}>
                <Eye className="w-4 h-4" /> View product
              </DropdownMenuItem>
              {supplier && (
                <DropdownMenuItem onClick={() => onViewSupplier(supplier as unknown as Supplier)}>View supplier</DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleSaveClick}>
                <Bookmark className="w-4 h-4" /> {isSaved ? "Unsave" : "Save"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleShare}>
                <Share2 className="w-4 h-4" /> Share
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="w-4 h-4" /> Download details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleRequestVideoClick}>
                <Video className="w-4 h-4" /> Request video
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Design / Manufacture */}
      <div className="px-4 pb-3 flex flex-col gap-1">
        <button
          type="button"
          onClick={(e) => handleWorkflowClick(e, "design")}
          disabled={pendingWorkflow !== null}
          className="flex items-center gap-1.5 text-[12px] font-medium text-neutral-800 hover:text-black disabled:opacity-60"
        >
          {pendingWorkflow === "design" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pencil className="w-3.5 h-3.5" />}
          Design your own {kindLabel}
        </button>
        <button
          type="button"
          onClick={(e) => handleWorkflowClick(e, "manufacture")}
          disabled={pendingWorkflow !== null}
          className="flex items-center gap-1.5 text-[12px] font-medium text-neutral-800 hover:text-black disabled:opacity-60"
        >
          {pendingWorkflow === "manufacture" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Factory className="w-3.5 h-3.5" />}
          Manufacture your own {kindLabel}
        </button>
      </div>

      {/* Media — dominant, matches reference proportions */}
      <div className="relative mx-3 rounded-xl overflow-hidden bg-neutral-200 cursor-pointer" onClick={() => onClick(product)}>
        {activeMedia ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activeMedia.src}
            alt={product.name}
            className="block w-full h-auto object-cover select-none"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="aspect-[3/4] bg-neutral-200" />
        )}

        {/* Save — top-left overlay */}
        <button
          type="button"
          onClick={handleSaveClick}
          className={cn(
            "absolute top-2.5 left-2.5 z-10 inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-semibold backdrop-blur-md",
            isSaved ? "bg-neutral-900 text-white" : "bg-white/90 text-neutral-900"
          )}
          aria-label={isSaved ? "Unsave" : "Save"}
        >
          <Bookmark className="w-3 h-3" fill={isSaved ? "currentColor" : "none"} />
          Save
        </button>

        {/* Share + wish count — top-right overlay, stacked */}
        <div className="absolute top-2.5 right-2.5 z-10 flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center justify-center rounded-full p-1.5 bg-white/90 text-neutral-900 backdrop-blur-md"
            aria-label="Share"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleSaveClick}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold bg-white/90 text-neutral-900 backdrop-blur-md"
            aria-label="Wish count"
          >
            <Heart className={cn("w-3 h-3", isSaved && "fill-rose-500 text-rose-500")} />
            {formatCompactCount(product.savedCount)}
          </button>
        </div>

        {/* Front/Back/Side/Labels — real positional views only, never a fake Video tab */}
        {media.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 rounded-full bg-black/55 px-1 py-0.5 backdrop-blur-md">
            {media.map((option) => (
              <button
                key={option.kind}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveKind(option.kind);
                }}
                className={cn(
                  "px-2 py-1 rounded-full text-[10px] font-medium text-white/80",
                  (activeMedia?.kind ?? media[0]?.kind) === option.kind && "bg-white text-neutral-900"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-4 pt-3 pb-4 space-y-3">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span key={tag} className={cn("px-2 py-0.5 text-[10px] font-medium rounded-full", getTagColor(tag))}>
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 text-[11px] border-t border-black/8 pt-3">
          <div>
            <p className="text-[9px] uppercase tracking-wide text-neutral-500">Interest Received</p>
            <p className="font-bold text-[14px] tabular-nums flex items-center gap-1 text-emerald-700">
              <TrendingUp className="w-3 h-3" /> {formatCompactCount(product.savedCount)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wide text-neutral-500">Global Buyers</p>
            <p className="font-bold text-[14px] tabular-nums flex items-center justify-end gap-1">
              <Users className="w-3 h-3" /> {formatCompactCount(product.globalBuyers)}
            </p>
          </div>
        </div>

        {(sizes.length > 0 || colors.length > 0) && (
          <div className="flex items-start justify-between gap-3">
            {sizes.length > 0 && (
              <div>
                <p className="text-[9px] uppercase tracking-wide text-neutral-500 mb-1">Available Sizes</p>
                <div className="flex flex-wrap gap-1">
                  {sizes.map((size) => (
                    <span
                      key={size}
                      className="min-w-6 h-6 px-1.5 inline-flex items-center justify-center rounded-full border border-neutral-300 text-[10px] font-medium"
                    >
                      {size}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {colors.length > 0 && (
              <div>
                <p className="text-[9px] uppercase tracking-wide text-neutral-500 mb-1">Color Palette</p>
                <div className="flex gap-1">
                  {colors.map((color) => (
                    <span
                      key={color.name}
                      title={color.name}
                      className="w-4 h-4 rounded-full border border-black/15"
                      style={{ backgroundColor: color.hex }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 text-[10px] text-neutral-600 border-t border-black/8 pt-3">
          <div className="flex items-center gap-3 min-w-0">
            {supplier && (
              <Link
                href={`/crm?supplierId=${supplier.id}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 font-medium hover:text-black"
              >
                <MessageCircle className="w-3 h-3" /> Message
              </Link>
            )}
            {supplier?.whatsapp && (
              <a
                href={whatsappHref(supplier.whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 font-medium text-[#128C7E] hover:underline"
              >
                WhatsApp
              </a>
            )}
          </div>
          <span className="inline-flex items-center gap-1 tabular-nums shrink-0">
            <Heart className="w-3 h-3" /> {formatCompactCount(product.savedCount)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/70 border border-black/8 px-2.5 py-2">
          <div>
            <p className="text-[9px] uppercase tracking-wide text-neutral-500">Price Range</p>
            <p className="text-[13px] font-bold leading-tight">{product.priceRange || "—"}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wide text-neutral-500">MOQ</p>
            <p className="text-[13px] font-semibold leading-tight">{product.moq || "—"}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleViewOfferClick}
            className="py-2 rounded-full bg-white border border-neutral-300 text-[11px] font-semibold hover:bg-neutral-50"
          >
            View Offer
          </button>
          <button
            type="button"
            onClick={handleCounterOfferClick}
            className="py-2 rounded-full bg-neutral-900 text-white text-[11px] font-semibold hover:bg-black"
          >
            Counter Offer
          </button>
        </div>
      </div>
    </motion.div>
  );
}
