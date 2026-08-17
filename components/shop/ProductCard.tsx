"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  Download,
  Share2,
  Eye,
  Building2,
  MessageCircle,
  ShieldCheck,
  MapPin,
  PlayCircle,
  Video,
  Wallet,
  Handshake,
  Pencil,
  Factory,
  Loader2,
} from "lucide-react";
import { Product } from "@/types/product";
import { Supplier } from "@/types/supplier";
import { getProductTags, getTagColor } from "@/lib/product-tags";
import { downloadDetails, shareDetails } from "@/lib/card-actions";
import { hasProductVideo } from "@/lib/product-engagement";
import { createCatalogRowFromShopProductAction } from "@/services/shop";
import { useSession } from "@/hooks/use-session";
import { ProductImageSlider } from "./ProductImageSlider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Design Your Own / Manufacture Your Own live under CatalogRow-based
 * routes, one variant per portal — Shop itself is only reachable from
 * buyer/supplier/freelancer, so this always resolves to a real route. */
function productBasePath(role: string | undefined): string {
  if (role === "SUPPLIER") return "/supplier/product";
  if (role === "FREELANCER") return "/freelancer/product";
  return "/buyer/product";
}

export function ProductCard({
  product,
  onClick,
  onViewSupplier,
  onWatchVideo,
  onRequestVideo,
  onCounterOffer,
  isSaved,
  onToggleSave,
}: {
  product: Product;
  onClick: (product: Product) => void;
  onViewSupplier: (supplier: Supplier) => void;
  onWatchVideo: (product: Product) => void;
  onRequestVideo: (product: Product) => void;
  onCounterOffer: (product: Product, initialStep: "terms" | "offer") => void;
  isSaved: boolean;
  onToggleSave: (product: Product) => void;
}) {
  const router = useRouter();
  const session = useSession();
  const [isHovered, setIsHovered] = useState(false);
  const [pendingWorkflow, setPendingWorkflow] = useState<"design" | "manufacture" | null>(null);
  const tags = getProductTags(product);
  const supplier = product.supplier;
  const hasVideo = hasProductVideo(product);
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
        { label: "Tags", value: tags.join(", ") },
        {
          label: "Contact",
          value: supplier?.phone || supplier?.email || supplier?.whatsapp || "Not available",
        },
        {
          label: "Supplier Profile",
          value: supplier ? `${window.location.origin}/directory?supplierId=${supplier.id}` : "N/A",
        },
      ],
    });
  }

  function handleShare(e: React.MouseEvent) {
    e.stopPropagation();
    shareDetails({
      title: product.name,
      text: `${product.name} from ${supplier?.companyName ?? "a verified supplier"} — ${product.priceRange ?? ""}`,
      url: `${window.location.origin}/shop?productId=${product.id}`,
    });
  }

  function handleSaveClick(e: React.MouseEvent) {
    e.stopPropagation();
    requireAuth("save", () => onToggleSave(product));
  }

  function handleWatchVideo(e: React.MouseEvent) {
    e.stopPropagation();
    onWatchVideo(product);
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
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      className="group relative break-inside-avoid mb-6 rounded-[20px] overflow-hidden bg-card border border-border shadow-card hover:shadow-elevated transition-shadow duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header: product name + Design/Manufacture Your Own */}
      <div className="px-5 pt-5 pb-3 cursor-pointer" onClick={() => onClick(product)}>
        <h3 className="font-semibold text-foreground text-base leading-snug mb-3 line-clamp-2">{product.name}</h3>

        <div className="flex flex-col gap-1.5">
          <button
            onClick={(e) => handleWorkflowClick(e, "design")}
            disabled={pendingWorkflow !== null}
            className="flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-primary transition-colors disabled:opacity-60"
          >
            {pendingWorkflow === "design" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pencil className="w-3.5 h-3.5" />}
            Design Your Own
          </button>
          <button
            onClick={(e) => handleWorkflowClick(e, "manufacture")}
            disabled={pendingWorkflow !== null}
            className="flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-primary transition-colors disabled:opacity-60"
          >
            {pendingWorkflow === "manufacture" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Factory className="w-3.5 h-3.5" />}
            Manufacture Your Own
          </button>
        </div>
      </div>

      {/* Image slider */}
      <div className="relative overflow-hidden bg-muted cursor-pointer" onClick={() => onClick(product)}>
        <ProductImageSlider images={product.images} alt={product.name} />

        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none transition-opacity duration-300",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Save / Download / Share */}
        <div
          className={cn(
            "absolute top-3 right-3 z-10 flex items-center gap-1.5 transition-opacity duration-200",
            isHovered || isSaved ? "opacity-100" : "opacity-0"
          )}
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  onClick={handleSaveClick}
                  className={cn(
                    "p-2 rounded-full backdrop-blur-md transition-colors duration-200",
                    isSaved ? "bg-rose-500 text-white" : "bg-black/40 text-white hover:bg-black/60"
                  )}
                  aria-label="Save product"
                />
              }
            >
              <Bookmark className="w-4 h-4" fill={isSaved ? "currentColor" : "none"} />
            </TooltipTrigger>
            <TooltipContent>Save</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  onClick={handleDownload}
                  className="p-2 rounded-full backdrop-blur-md bg-black/40 text-white hover:bg-black/60 transition-colors duration-200"
                  aria-label="Download product details"
                />
              }
            >
              <Download className="w-4 h-4" />
            </TooltipTrigger>
            <TooltipContent>Download</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  onClick={handleShare}
                  className="p-2 rounded-full backdrop-blur-md bg-black/40 text-white hover:bg-black/60 transition-colors duration-200"
                  aria-label="Share product"
                />
              }
            >
              <Share2 className="w-4 h-4" />
            </TooltipTrigger>
            <TooltipContent>Share</TooltipContent>
          </Tooltip>
        </div>

        {/* Quick actions */}
        <div
          className={cn(
            "absolute bottom-3 left-3 right-3 z-10 flex items-center gap-2 transition-all duration-300",
            isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
          )}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick(product);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full bg-white/95 text-slate-900 text-xs font-semibold hover:bg-white transition-colors"
          >
            <Eye className="w-3.5 h-3.5" /> Quick View
          </button>
          {supplier && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewSupplier(supplier as unknown as Supplier);
              }}
              className="p-2 rounded-full bg-white/95 text-slate-900 hover:bg-white transition-colors"
              aria-label="View supplier"
            >
              <Building2 className="w-3.5 h-3.5" />
            </button>
          )}
          {supplier && (
            <Link
              href={`/crm?supplierId=${supplier.id}`}
              onClick={(e) => e.stopPropagation()}
              className="p-2 rounded-full bg-white/95 text-slate-900 hover:bg-white transition-colors"
              aria-label="Contact supplier"
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 cursor-pointer" onClick={() => onClick(product)}>
        {supplier && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewSupplier(supplier as unknown as Supplier);
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2.5 hover:text-foreground transition-colors"
          >
            <span className="truncate font-medium">{supplier.companyName}</span>
            {supplier.verified && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
          </button>
        )}

        {supplier?.city && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-3">
            <MapPin className="w-3 h-3" /> {supplier.city}
          </div>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {tags.map((tag) => (
              <span key={tag} className={cn("px-2 py-0.5 text-[10px] font-medium rounded-full", getTagColor(tag))}>
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-end justify-between pt-3 pb-4 border-t border-border/60">
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5">Price Range</p>
            <p className="font-bold text-foreground text-[15px]">{product.priceRange}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground mb-0.5">MOQ</p>
            <p className="font-medium text-foreground text-sm">{product.moq}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {hasVideo ? (
            <button
              onClick={handleWatchVideo}
              className="flex items-center justify-center gap-1.5 py-2 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-semibold hover:bg-emerald-500/20 transition-colors duration-200"
            >
              <PlayCircle className="w-3.5 h-3.5" /> Video Available
            </button>
          ) : (
            <button
              onClick={handleRequestVideoClick}
              className="flex items-center justify-center gap-1.5 py-2 rounded-full bg-muted text-muted-foreground text-xs font-semibold hover:bg-accent hover:text-accent-foreground transition-colors duration-200"
            >
              <Video className="w-3.5 h-3.5" /> Request Video
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleViewOfferClick}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors duration-200"
            >
              <Wallet className="w-3.5 h-3.5" /> View Offer
            </button>
            <button
              onClick={handleCounterOfferClick}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors duration-200"
            >
              <Handshake className="w-3.5 h-3.5" /> Counter Offer
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
