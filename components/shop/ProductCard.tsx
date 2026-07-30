"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Bookmark, Eye, Building2, MessageCircle, ShieldCheck, MapPin, Star } from "lucide-react";
import { Product } from "@/types/product";
import { Supplier } from "@/types/supplier";
import { getProductTags, getTagColor } from "@/lib/product-tags";
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="group relative break-inside-avoid mb-5 rounded-2xl overflow-hidden bg-card border border-border shadow-card hover:shadow-elevated transition-shadow duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image */}
      <div className="relative overflow-hidden bg-muted cursor-pointer" onClick={() => onClick(product)}>
        <motion.img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-auto object-cover"
          animate={{ scale: isHovered ? 1.06 : 1 }}
          transition={{ duration: 0.4 }}
          loading="lazy"
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none"
        />

        {/* Save */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsSaved((v) => !v);
          }}
          className={cn(
            "absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-all",
            isHovered || isSaved ? "opacity-100" : "opacity-0",
            isSaved ? "bg-rose-500 text-white" : "bg-black/40 text-white hover:bg-black/60"
          )}
          aria-label="Save product"
        >
          <Bookmark className="w-4 h-4" fill={isSaved ? "currentColor" : "none"} />
        </button>

        {/* Quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 8 }}
          transition={{ duration: 0.2 }}
          className="absolute bottom-3 left-3 right-3 flex items-center gap-2"
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
        </motion.div>
      </div>

      {/* Content */}
      <div className="p-4 cursor-pointer" onClick={() => onClick(product)}>
        <h3 className="font-semibold text-foreground text-[15px] leading-snug mb-1.5 line-clamp-2">
          {product.name}
        </h3>

        {supplier && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewSupplier(supplier as unknown as Supplier);
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2 hover:text-foreground transition-colors"
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

        <div className="flex flex-wrap gap-1.5 mb-3">
          {tags.map((tag) => (
            <span
              key={tag}
              className={cn("px-2 py-0.5 text-[10px] font-medium rounded-full", getTagColor(tag))}
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-end justify-between pt-2 border-t border-border/60">
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5">Price Range</p>
            <p className="font-semibold text-foreground text-sm">{product.priceRange}</p>
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
