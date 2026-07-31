"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Bookmark, Download, Share2, Eye, Building2, MessageCircle, ShieldCheck, MapPin, Star } from "lucide-react";
import { Product } from "@/types/product";
import { Supplier } from "@/types/supplier";
import { getProductTags, getTagColor } from "@/lib/product-tags";
import { downloadDetails, shareDetails } from "@/lib/card-actions";
import { ProductImageSlider } from "./ProductImageSlider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function ProductCard({
  product,
  onClick,
  onViewSupplier,
}: {
  product: Product;
  onClick: (product: Product) => void;
  onViewSupplier: (supplier: Supplier) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const tags = getProductTags(product);
  const supplier = product.supplier;

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
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSaved((v) => !v);
                  }}
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
        <h3 className="font-semibold text-foreground text-base leading-snug mb-2 line-clamp-2">
          {product.name}
        </h3>

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

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-3 flex-wrap">
          {supplier?.city && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {supplier.city}
            </span>
          )}
          {supplier?.yearEstablished && <span>Since {supplier.yearEstablished}</span>}
          {!!supplier?.rating && (
            <span className="flex items-center gap-0.5">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {supplier.rating.toFixed(1)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {tags.map((tag) => (
            <span
              key={tag}
              className={cn("px-2 py-0.5 text-[10px] font-medium rounded-full", getTagColor(tag))}
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-end justify-between pt-3 border-t border-border/60">
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5">Price Range</p>
            <p className="font-bold text-foreground text-[15px]">{product.priceRange}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground mb-0.5">MOQ</p>
            <p className="font-medium text-foreground text-sm">{product.moq}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
