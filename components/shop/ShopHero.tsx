"use client";

import { Search } from "lucide-react";
import { FeaturedSlider } from "./FeaturedSlider";
import { SHOP_CATEGORY_CHIPS, TRENDING_SEARCHES } from "@/lib/shop-data";
import { cn } from "@/lib/utils";

interface ShopHeroProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onChipToggle: (chip: string) => void;
  onCategorySelect: (category: string) => void;
  isChipActive: (chip: string) => boolean;
}

export function ShopHero({
  searchQuery,
  setSearchQuery,
  onChipToggle,
  onCategorySelect,
  isChipActive,
}: ShopHeroProps) {
  return (
    <div className="pt-2 pb-8 space-y-6">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-2">
          Discover Wholesale Fashion
        </h1>
        <p className="text-muted-foreground text-base max-w-2xl">
          Browse curated collections from verified manufacturers, wholesalers, and exporters —
          connect directly, no middlemen.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-2xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search products, suppliers, brands, fabrics..."
          className="w-full pl-12 pr-4 py-3.5 rounded-full bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring transition-all text-sm sm:text-base shadow-card"
        />
      </div>

      {/* Trending searches */}
      <div className="flex flex-wrap items-center gap-2 max-w-2xl">
        <span className="text-xs text-muted-foreground font-medium shrink-0">Trending:</span>
        {TRENDING_SEARCHES.slice(0, 5).map((term) => (
          <button
            key={term}
            onClick={() => setSearchQuery(term)}
            className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {term}
          </button>
        ))}
      </div>

      {/* Category chips */}
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1 pb-1">
        {SHOP_CATEGORY_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => onChipToggle(chip)}
            className={cn(
              "whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all shrink-0 border",
              isChipActive(chip)
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
            )}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Featured slider */}
      <FeaturedSlider onSlideClick={onCategorySelect} />
    </div>
  );
}
