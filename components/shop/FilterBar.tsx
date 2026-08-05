"use client";

import { SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FASHION_CATEGORIES, DEFAULT_FILTERS, type ShopFilters } from "@/lib/shop-data";
import { cn } from "@/lib/utils";
import { AdvancedFilters, countActiveFilters } from "./AdvancedFilters";

// Re-exported for backward compatibility — the canonical definitions now
// live in lib/shop-data.ts (a neutral module) so FilterBar and
// AdvancedFilters can both depend on them without importing each other.
export { DEFAULT_FILTERS, type ShopFilters };

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border whitespace-nowrap",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-muted text-muted-foreground border-transparent hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {children}
    </button>
  );
}

export function FilterBar({
  resultCount,
  activeCategory,
  setActiveCategory,
  activeSort,
  setActiveSort,
  filters,
  setFilters,
}: {
  resultCount?: number;
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  activeSort: string;
  setActiveSort: (s: string) => void;
  filters: ShopFilters;
  setFilters: (f: ShopFilters) => void;
}) {
  const sorts = ["Trending", "Newest", "MOQ", "Price"];
  const activeCount = countActiveFilters(filters);

  return (
    <div className="sticky top-0 z-30 -mx-6 lg:-mx-8 px-6 lg:px-8 py-3 bg-background/85 backdrop-blur-xl border-b border-border">
      <div className="flex items-center gap-3">
        {/* Category pills */}
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar flex-1">
          <Chip active={activeCategory === "All Categories"} onClick={() => setActiveCategory("All Categories")}>
            All
          </Chip>
          {FASHION_CATEGORIES.map((cat) => (
            <Chip key={cat} active={activeCategory === cat} onClick={() => setActiveCategory(cat)}>
              {cat}
            </Chip>
          ))}
        </div>

        {/* Sort */}
        <div className="hidden md:flex items-center gap-1 bg-muted p-1 rounded-full shrink-0">
          {sorts.map((sort) => (
            <button
              key={sort}
              onClick={() => setActiveSort(sort)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                activeSort === sort
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {sort}
            </button>
          ))}
        </div>

        {/* Filters popover */}
        <Popover>
          <PopoverTrigger
            render={
              <button className="relative shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-border bg-card text-foreground text-xs font-medium hover:bg-muted transition-colors" />
            }
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {activeCount > 0 && (
              <span className="ml-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px]">
                {activeCount}
              </span>
            )}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[320px] max-h-[70vh] overflow-y-auto scrollbar-thin p-5">
            <AdvancedFilters filters={filters} setFilters={setFilters} />
          </PopoverContent>
        </Popover>
      </div>

      {typeof resultCount === "number" && (
        <p className="text-xs text-muted-foreground mt-2">{resultCount} products</p>
      )}
    </div>
  );
}
