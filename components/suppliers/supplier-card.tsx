"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  Clock,
  ShoppingBag,
  Star,
  Phone,
  Mail,
  MessageCircle,
  Bookmark,
  ExternalLink,
  BadgeCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type Supplier } from "@/types/supplier";
import Link from "next/link";

interface SupplierCardProps {
  supplier: Supplier;
  delay?: number;
  onClick?: (supplier: Supplier) => void;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "h-3 w-3",
            star <= Math.floor(rating)
              ? "fill-amber-400 text-amber-400"
              : star - 0.5 <= rating
              ? "fill-amber-400/50 text-amber-400"
              : "fill-muted text-muted-foreground/30"
          )}
        />
      ))}
      <span className="text-xs font-medium text-foreground ml-0.5">{rating.toFixed(1)}</span>
    </div>
  );
}

export function SupplierCard({ supplier, delay = 0, onClick }: SupplierCardProps) {
  const [saved, setSaved] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, delay, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      onClick={() => onClick?.(supplier)}
      className="group relative rounded-xl bg-card border border-border shadow-sm hover:shadow-md hover:border-border/80 transition-shadow duration-200 flex flex-col overflow-hidden cursor-pointer"
    >
      {/* Top stripe */}
      <div
        className="h-1 w-full shrink-0"
        style={{ backgroundColor: supplier.logoColor }}
      />

      <div className="flex flex-col flex-1 p-5">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-4">
          {/* Logo / avatar */}
          <div
            className="flex items-center justify-center w-12 h-12 rounded-xl text-white font-bold text-sm shrink-0 shadow-sm"
            style={{ backgroundColor: supplier.logoColor }}
          >
            {supplier.initials}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                {supplier.companyName}
              </h3>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => setSaved((v) => !v)}
                className={cn(
                  "shrink-0 p-1 rounded-lg transition-colors",
                  saved
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="Save supplier"
              >
                <Bookmark
                  className="h-4 w-4"
                  fill={saved ? "currentColor" : "none"}
                />
              </motion.button>
            </div>

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {supplier.verified && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <BadgeCheck className="h-3 w-3" />
                  Verified
                </span>
              )}
              <Badge variant="secondary" className="text-[11px] h-4 px-1.5">
                {supplier.supplierType}
              </Badge>
            </div>
          </div>
        </div>

        {/* Rating + meta */}
        <div className="flex items-center justify-between mb-3">
          <StarRating rating={supplier.rating} />
          <span className="text-[11px] text-muted-foreground">
            {supplier.reviewCount} reviews
          </span>
        </div>

        {/* Location + industry row */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            {supplier.city}, {supplier.country}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3 shrink-0" />
            {supplier.employees}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-4 flex-1">
          {supplier.description}
        </p>

        {/* Top products */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {supplier.products.slice(0, 3).map((product) => (
            <span
              key={product}
              className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60"
            >
              {product}
            </span>
          ))}
          {supplier.products.length > 3 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              +{supplier.products.length - 3}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-2 mb-4 p-3 rounded-lg bg-muted/40 border border-border/40">
          <div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
              <Clock className="h-2.5 w-2.5" />
              Response
            </div>
            <p className="text-xs font-medium text-foreground">{supplier.responseTime}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
              <ShoppingBag className="h-2.5 w-2.5" />
              Min. Order
            </div>
            <p className="text-xs font-medium text-foreground">{supplier.minimumOrder}</p>
          </div>
        </div>

        {/* Industry chip */}
        <div className="flex items-center justify-between mb-4">
          <span
            className="text-[11px] font-medium px-2 py-1 rounded-md"
            style={{
              backgroundColor: `${supplier.logoColor}18`,
              color: supplier.logoColor,
            }}
          >
            {supplier.industry}
          </span>
          <span className="text-[11px] text-muted-foreground">
            Est. {supplier.yearEstablished}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 mt-auto">
          <Button size="sm" className="w-full gap-1.5 h-8 text-xs">
            <ExternalLink className="h-3 w-3" />
            View Profile
          </Button>
          <div className="grid grid-cols-3 gap-1.5">
            <Link
              href={"/dashboard/crm?supplierId=" + supplier.id}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 h-7 flex items-center justify-center gap-1 text-[11px] rounded-lg border border-border bg-background hover:bg-muted hover:text-foreground transition-colors font-medium"
              title={`WhatsApp ${supplier.whatsapp}`}
            >
              <MessageCircle className="h-3 w-3 text-emerald-500" />
              <span>Chat</span>
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-0 gap-1 text-[11px]"
              title={supplier.email ?? undefined}
            >
              <Mail className="h-3 w-3 text-blue-500" />
              <span>Email</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-0 gap-1 text-[11px]"
              title={supplier.phone ?? undefined}
            >
              <Phone className="h-3 w-3 text-violet-500" />
              <span>Call</span>
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
