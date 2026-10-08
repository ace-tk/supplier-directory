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
  emerald: "bg-mint text-mint-ink border-mint-ink/30 ",
  blue: "bg-sky text-sky-ink border-sky-ink/30 ",
  violet: "bg-lav text-lav-ink border-lav-ink/30 ",
  orange: "bg-peach text-peach-ink border-peach-ink/30 ",
  amber: "bg-butter text-butter-ink border-butter-ink/30 ",
  red: "bg-rose text-rose-ink border-rose-ink/30 ",
  slate: "bg-soft/10 text-foreground border-border ",
  rose: "bg-rose text-rose-ink border-rose-ink/30 ",
  pink: "bg-rose text-rose-ink border-rose-ink/30 ",
  green: "bg-mint text-mint-ink border-mint-ink/30 ",
};

const activeColorMap: Record<string, string> = {
  emerald: "bg-emerald-500 text-white border-mint-ink/30",
  blue: "bg-blue-500 text-white border-sky-ink/30",
  violet: "bg-violet-500 text-white border-lav-ink/30",
  orange: "bg-orange-500 text-white border-peach-ink/30",
  amber: "bg-amber-500 text-white border-butter-ink/30",
  red: "bg-red-500 text-white border-rose-ink/30",
  slate: "bg-muted-foreground text-background border-border",
  rose: "bg-rose-500 text-white border-rose-ink/30",
  pink: "bg-pink-500 text-white border-rose-ink/30",
  green: "bg-green-500 text-white border-mint-ink/30",
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
