"use client";

import { motion } from "framer-motion";
import type { ComponentType } from "react";
import { Shirt, Baby, Footprints, Gem, Home, Factory, Warehouse, Ship } from "lucide-react";
import { type Supplier, type FilterKey } from "@/types/supplier";
import { countryFlag } from "@/lib/geo";
import { cn } from "@/lib/utils";

interface CategoryConfig {
  key: FilterKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
  match: (s: Supplier) => boolean;
}

const CATEGORIES: CategoryConfig[] = [
  { key: "Women", label: "Women's Wear", icon: Shirt, match: (s) => s.industry === "Women" },
  { key: "Men", label: "Men's Wear", icon: Shirt, match: (s) => s.industry === "Men" },
  { key: "Kids Wear", label: "Kids Wear", icon: Baby, match: (s) => s.industry === "Kids Wear" },
  { key: "Footwear", label: "Footwear", icon: Footprints, match: (s) => s.industry === "Footwear" },
  { key: "Accessories", label: "Accessories", icon: Gem, match: (s) => s.industry === "Accessories" },
  { key: "Home Textiles", label: "Home Textiles", icon: Home, match: (s) => s.industry === "Home Textiles" },
  { key: "Manufacturer", label: "Manufacturers", icon: Factory, match: (s) => s.supplierType === "Manufacturer" },
  { key: "Wholesaler", label: "Wholesalers", icon: Warehouse, match: (s) => s.supplierType === "Wholesaler" },
  { key: "Exporter", label: "Exporters", icon: Ship, match: (s) => s.supplierType === "Exporter" },
];

export function BrowseCategories({
  suppliers,
  activeFilters,
  onSelect,
}: {
  suppliers: Supplier[];
  activeFilters: FilterKey[];
  onSelect: (key: FilterKey) => void;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground mb-3">Browse by Category</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {CATEGORIES.map((cat, i) => {
          const matched = suppliers.filter(cat.match);
          const countries = Array.from(new Set(matched.map((s) => s.country)));
          const isActive = activeFilters.includes(cat.key);

          return (
            <motion.button
              key={cat.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.2) }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(cat.key)}
              className={cn(
                "flex flex-col items-start gap-2 p-3.5 rounded-xl border text-left transition-colors duration-150",
                isActive
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-border/80 hover:bg-muted/40"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-lg shrink-0",
                  isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                <cat.icon className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{cat.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {matched.length} supplier{matched.length !== 1 ? "s" : ""} · {countries.length}{" "}
                  {countries.length === 1 ? "country" : "countries"}
                </p>
              </div>

              {countries.length > 0 && (
                <div className="flex items-center gap-1 text-xs leading-none">
                  {countries.slice(0, 4).map((c) => (
                    <span key={c} title={c}>
                      {countryFlag(c)}
                    </span>
                  ))}
                  {countries.length > 4 && (
                    <span className="text-[10px] text-muted-foreground">+{countries.length - 4}</span>
                  )}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
