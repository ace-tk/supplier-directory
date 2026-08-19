"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Chip, AdvancedFilterFields, DEFAULT_FILTERS, type ShopFilters } from "./FilterBar";
import { FASHION_CATEGORIES } from "@/lib/shop-data";
import { cn } from "@/lib/utils";

const SORTS = ["Trending", "Newest", "MOQ", "Price"];

/**
 * The floating "Filters" button's destination once the in-page FilterBar
 * has scrolled out of view. Not a second filtering system — every control
 * here reads/writes the exact same activeCategory/activeSort/filters state
 * the Shop page already owns, so results stay in sync with the bar above.
 */
export function FilterDrawer({
  open,
  onOpenChange,
  activeCategory,
  setActiveCategory,
  activeSort,
  setActiveSort,
  filters,
  setFilters,
  resultCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  activeSort: string;
  setActiveSort: (s: string) => void;
  filters: ShopFilters;
  setFilters: (f: ShopFilters) => void;
  resultCount?: number;
}) {
  function clearAll() {
    setActiveCategory("All Categories");
    setActiveSort("Trending");
    setFilters(DEFAULT_FILTERS);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm flex flex-col">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>{typeof resultCount === "number" ? `${resultCount} products` : "Refine the Shop feed"}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 space-y-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Category</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip active={activeCategory === "All Categories"} onClick={() => setActiveCategory("All Categories")}>
                All
              </Chip>
              {FASHION_CATEGORIES.map((cat) => (
                <Chip key={cat} active={activeCategory === cat} onClick={() => setActiveCategory(cat)}>
                  {cat}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Sort</p>
            <div className="flex items-center gap-1 bg-muted p-1 rounded-full w-fit">
              {SORTS.map((sort) => (
                <button
                  key={sort}
                  onClick={() => setActiveSort(sort)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                    activeSort === sort ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {sort}
                </button>
              ))}
            </div>
          </div>

          <AdvancedFilterFields filters={filters} setFilters={setFilters} />
        </div>

        <SheetFooter className="flex-row gap-2 border-t border-border pt-4">
          <Button variant="outline" className="flex-1" onClick={clearAll}>
            Clear filters
          </Button>
          <Button className="flex-1" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
