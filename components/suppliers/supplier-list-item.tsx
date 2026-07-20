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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type Supplier } from "@/types/supplier";

interface SupplierListItemProps {
  supplier: Supplier;
  delay?: number;
  onClick?: (supplier: Supplier) => void;
}

export function SupplierListItem({ supplier, delay = 0, onClick }: SupplierListItemProps) {
  const [saved, setSaved] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: 0.25, delay, ease: [0.4, 0, 0.2, 1] }}
      onClick={() => onClick?.(supplier)}
      className="group rounded-xl bg-card border border-border hover:border-border/80 hover:shadow-md transition-all duration-200 p-4 cursor-pointer"
    >
      <div className="flex items-start gap-4">
        {/* Logo */}
        <div
          className="flex items-center justify-center w-12 h-12 rounded-xl text-white font-bold text-sm shrink-0 shadow-sm"
          style={{ backgroundColor: supplier.logoColor }}
        >
          {supplier.initials}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            {/* Left: name + badges */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {supplier.companyName}
                </h3>
                {supplier.verified && (
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    <BadgeCheck className="h-3 w-3" />
                    Verified
                  </span>
                )}
                <Badge variant="secondary" className="text-[11px] h-4">
                  {supplier.supplierType}
                </Badge>
              </div>

              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {/* Rating */}
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-medium">{supplier.rating.toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground">({supplier.reviewCount})</span>
                </div>
                {/* Location */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {supplier.city}, {supplier.country}
                </div>
                {/* Industry */}
                <span
                  className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: `${supplier.logoColor}18`,
                    color: supplier.logoColor,
                  }}
                >
                  {supplier.industry}
                </span>
              </div>

              <p className="text-xs text-muted-foreground mt-2 line-clamp-1 max-w-xl">
                {supplier.description}
              </p>

              {/* Products */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {supplier.products.slice(0, 4).map((p) => (
                  <span
                    key={p}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: stats + actions */}
            <div className="flex flex-row sm:flex-col items-start sm:items-end gap-4 sm:gap-2 shrink-0">
              {/* Meta stats */}
              <div className="hidden sm:flex flex-col items-end gap-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {supplier.responseTime}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ShoppingBag className="h-3 w-3" />
                  {supplier.minimumOrder}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "h-7 w-7 shrink-0",
                    saved && "text-primary border-primary/40"
                  )}
                  onClick={() => setSaved((v) => !v)}
                  aria-label="Save"
                >
                  <Bookmark className="h-3.5 w-3.5" fill={saved ? "currentColor" : "none"} />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" title="WhatsApp">
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" title={supplier.email ?? undefined}>
                  <Mail className="h-3.5 w-3.5 text-blue-500" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" title={supplier.phone ?? undefined}>
                  <Phone className="h-3.5 w-3.5 text-violet-500" />
                </Button>
                <Button size="sm" className="h-7 gap-1 text-xs">
                  <ExternalLink className="h-3 w-3" />
                  View
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
