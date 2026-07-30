"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Bookmark,
  Share2,
  MessageCircle,
  Mail,
  ExternalLink,
  ShieldCheck,
  Factory,
  MapPin,
  Star,
} from "lucide-react";
import { Product } from "@/types/product";
import { Supplier } from "@/types/supplier";
import { useState } from "react";
import Link from "next/link";
import { getProductTags, getTagColor } from "@/lib/product-tags";
import { cn } from "@/lib/utils";

export function ProductDrawer({
  product,
  isOpen,
  onClose,
  onViewSupplier,
}: {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onViewSupplier: (supplier: Supplier) => void;
}) {
  const [activeImage, setActiveImage] = useState(0);

  if (!product) return null;

  const supplier = product.supplier;
  const tags = getProductTags(product);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full md:w-[600px] lg:w-[800px] bg-background z-50 shadow-2xl flex flex-col overflow-hidden border-l border-border"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
                <h2 className="font-semibold text-foreground">Product Details</h2>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors">
                  <Share2 className="w-5 h-5" />
                </button>
                <button className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors">
                  <Bookmark className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Scroll Area */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {/* Image Gallery */}
              <div className="bg-muted/40 p-6 flex flex-col items-center border-b border-border">
                <div className="relative w-full max-w-lg aspect-square rounded-2xl overflow-hidden bg-card shadow-card mb-4">
                  <img
                    src={product.images[activeImage] || product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                {product.images.length > 1 && (
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {product.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImage(idx)}
                        className={cn(
                          "relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-all shrink-0",
                          activeImage === idx ? "border-primary" : "border-transparent hover:border-border"
                        )}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-8 max-w-3xl mx-auto">
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-md uppercase tracking-wider">
                      {product.category}
                    </span>
                  </div>
                  <h1 className="text-3xl font-bold text-foreground mb-4 leading-tight">
                    {product.name}
                  </h1>
                  <p className="text-muted-foreground text-base leading-relaxed">
                    {product.description}
                  </p>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-8">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className={cn("px-2.5 py-1 text-xs font-medium rounded-full", getTagColor(tag))}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                  <div className="bg-muted/50 p-4 rounded-2xl border border-border">
                    <p className="text-xs text-muted-foreground mb-1 font-medium">Price Range</p>
                    <p className="text-lg font-bold text-foreground">{product.priceRange}</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-2xl border border-border">
                    <p className="text-xs text-muted-foreground mb-1 font-medium">Min. Order (MOQ)</p>
                    <p className="text-lg font-bold text-foreground">{product.moq}</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-2xl border border-border">
                    <p className="text-xs text-muted-foreground mb-1 font-medium">Lead Time</p>
                    <p className="text-lg font-bold text-foreground">{product.leadTime}</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-2xl border border-border">
                    <p className="text-xs text-muted-foreground mb-1 font-medium">Material</p>
                    <p className="text-lg font-bold text-foreground">{product.material || "N/A"}</p>
                  </div>
                </div>

                {/* Supplier Card */}
                {supplier && (
                  <div className="mb-10">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Supplier Information</h3>
                    <div className="bg-card border border-border rounded-3xl p-6 shadow-card hover:shadow-elevated transition-shadow">
                      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                          <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-sm shrink-0"
                            style={{ backgroundColor: supplier.logoColor || "#6366F1" }}
                          >
                            {supplier.initials || supplier.companyName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h4 className="font-bold text-foreground text-xl">{supplier.companyName}</h4>
                              {supplier.verified && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
                                  <ShieldCheck className="w-4 h-4" /> Verified
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <Factory className="w-3.5 h-3.5" /> {supplier.supplierType}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" /> {supplier.city}, {supplier.country}
                              </span>
                              {supplier.yearEstablished && <span>Since {supplier.yearEstablished}</span>}
                              {!!supplier.rating && (
                                <span className="flex items-center gap-1">
                                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                  {supplier.rating.toFixed(1)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => onViewSupplier(supplier as unknown as Supplier)}
                          className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 bg-primary/10 px-4 py-2 rounded-full transition-colors"
                        >
                          View Profile <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <Link
                          href={"/crm?supplierId=" + supplier.id}
                          className="flex items-center justify-center gap-2 w-full py-3 bg-[#25D366] hover:bg-[#1EBE5D] text-white rounded-xl font-semibold transition-colors"
                        >
                          <MessageCircle className="w-5 h-5" /> WhatsApp
                        </Link>
                        <button className="flex items-center justify-center gap-2 w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold transition-colors">
                          <Mail className="w-5 h-5" /> Contact Supplier
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Specs */}
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Specifications</h3>
                  <div className="bg-muted/50 rounded-2xl p-6 text-muted-foreground border border-border">
                    {product.specifications || "No specifications provided."}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
