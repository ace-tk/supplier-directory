"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { type FilterKey } from "@/types/supplier";

const FILTER_GROUPS = [
  {
    label: "Status",
    filters: [
      { key: "verified" as FilterKey, label: "Verified", color: "emerald" },
    ],
  },
  {
    label: "Type",
    filters: [
      { key: "Manufacturer" as FilterKey, label: "Manufacturer", color: "blue" },
      { key: "Exporter" as FilterKey, label: "Exporter", color: "violet" },
      { key: "Wholesaler" as FilterKey, label: "Wholesaler", color: "orange" },
    ],
  },
  {
    label: "Country",
    filters: [
      { key: "India" as FilterKey, label: "🇮🇳 India", color: "amber" },
      { key: "China" as FilterKey, label: "🇨🇳 China", color: "red" },
      { key: "USA" as FilterKey, label: "🇺🇸 USA", color: "blue" },
      { key: "Germany" as FilterKey, label: "🇩🇪 Germany", color: "slate" },
      { key: "Turkey" as FilterKey, label: "🇹🇷 Turkey", color: "rose" },
    ],
  },
  {
    label: "Industry",
    filters: [
      { key: "Electronics" as FilterKey, label: "Electronics", color: "blue" },
      { key: "Textiles" as FilterKey, label: "Textiles", color: "pink" },
      { key: "Food & Beverage" as FilterKey, label: "Food", color: "green" },
      { key: "Furniture" as FilterKey, label: "Furniture", color: "amber" },
      { key: "Automotive" as FilterKey, label: "Automotive", color: "red" },
    ],
  },
];

const colorMap: Record<string, string> = {
  emerald: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
  blue: "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400",
  violet: "bg-violet-500/10 text-violet-700 border-violet-500/30 dark:text-violet-400",
  orange: "bg-orange-500/10 text-orange-700 border-orange-500/30 dark:text-orange-400",
  amber: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
  red: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400",
  slate: "bg-slate-500/10 text-slate-700 border-slate-500/30 dark:text-slate-400",
  rose: "bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-400",
  pink: "bg-pink-500/10 text-pink-700 border-pink-500/30 dark:text-pink-400",
  green: "bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400",
};

const activeColorMap: Record<string, string> = {
  emerald: "bg-emerald-500 text-white border-emerald-500",
  blue: "bg-blue-500 text-white border-blue-500",
  violet: "bg-violet-500 text-white border-violet-500",
  orange: "bg-orange-500 text-white border-orange-500",
  amber: "bg-amber-500 text-white border-amber-500",
  red: "bg-red-500 text-white border-red-500",
  slate: "bg-slate-500 text-white border-slate-500",
  rose: "bg-rose-500 text-white border-rose-500",
  pink: "bg-pink-500 text-white border-pink-500",
  green: "bg-green-500 text-white border-green-500",
};

interface SupplierFiltersProps {
  activeFilters: FilterKey[];
  onToggle: (key: FilterKey) => void;
  onClear: () => void;
}

export function SupplierFilters({
  activeFilters,
  onToggle,
  onClear,
}: SupplierFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
        </div>
        <AnimatePresence>
          {activeFilters.length > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={onClear}
              className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
              Clear all
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTER_GROUPS.map((group) =>
          group.filters.map((filter) => {
            const isActive = activeFilters.includes(filter.key);
            return (
              <motion.button
                key={filter.key}
                whileTap={{ scale: 0.93 }}
                onClick={() => onToggle(filter.key)}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-150",
                  isActive
                    ? activeColorMap[filter.color]
                    : colorMap[filter.color]
                )}
              >
                {isActive && (
                  <motion.span
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "auto", opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <X className="h-2.5 w-2.5" />
                  </motion.span>
                )}
                {filter.label}
              </motion.button>
            );
          })
        )}
      </div>

      {/* Active filter summary */}
      <AnimatePresence>
        {activeFilters.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <p className="text-[11px] text-muted-foreground pt-1">
              {activeFilters.length} filter{activeFilters.length > 1 ? "s" : ""} active
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
