"use client";

import { SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FASHION_CATEGORIES, SHOP_CITIES } from "@/lib/shop-data";
import { cn } from "@/lib/utils";

export interface ShopFilters {
  city: string;
  verifiedOnly: boolean;
  material: string;
  country: string;
  exportOnly: boolean;
  readyStockOnly: boolean;
  moqBucket: "Any" | "Under 100" | "100-300" | "300+";
  priceBucket: "Any" | "Under ₹300" | "₹300–₹700" | "₹700–₹1500" | "Above ₹1500";
  productionTypes: string[];
}

export const DEFAULT_FILTERS: ShopFilters = {
  city: "All Cities",
  verifiedOnly: false,
  material: "All Materials",
  country: "All Countries",
  exportOnly: false,
  readyStockOnly: false,
  moqBucket: "Any",
  priceBucket: "Any",
  productionTypes: [],
};

const MATERIALS = ["Cotton", "Linen", "Silk", "Denim", "Leather", "Polyester", "Wool", "Canvas", "Rayon"];
const COUNTRIES = ["India", "Vietnam", "China"];
const MOQ_BUCKETS = ["Any", "Under 100", "100-300", "300+"] as const;
const PRICE_BUCKETS = ["Any", "Under ₹300", "₹300–₹700", "₹700–₹1500", "Above ₹1500"] as const;
const PRODUCTION_TYPES = ["Manufacturer", "Wholesaler", "OEM", "ODM"];

function countActiveFilters(f: ShopFilters): number {
  let n = 0;
  if (f.city !== DEFAULT_FILTERS.city) n++;
  if (f.verifiedOnly) n++;
  if (f.material !== DEFAULT_FILTERS.material) n++;
  if (f.country !== DEFAULT_FILTERS.country) n++;
  if (f.exportOnly) n++;
  if (f.readyStockOnly) n++;
  if (f.moqBucket !== "Any") n++;
  if (f.priceBucket !== "Any") n++;
  n += f.productionTypes.length;
  return n;
}

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

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
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

  function toggleProductionType(type: string) {
    setFilters({
      ...filters,
      productionTypes: filters.productionTypes.includes(type)
        ? filters.productionTypes.filter((t) => t !== type)
        : [...filters.productionTypes, type],
    });
  }

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
          <PopoverContent align="end" className="w-[320px] max-h-[70vh] overflow-y-auto scrollbar-thin p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground text-sm">Filters</h3>
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear all
              </button>
            </div>

            <FilterGroup label="Location">
              <Chip active={filters.city === "All Cities"} onClick={() => setFilters({ ...filters, city: "All Cities" })}>
                All Cities
              </Chip>
              {SHOP_CITIES.map((city) => (
                <Chip key={city} active={filters.city === city} onClick={() => setFilters({ ...filters, city })}>
                  📍 {city}
                </Chip>
              ))}
            </FilterGroup>

            <FilterGroup label="MOQ">
              {MOQ_BUCKETS.map((m) => (
                <Chip key={m} active={filters.moqBucket === m} onClick={() => setFilters({ ...filters, moqBucket: m })}>
                  {m}
                </Chip>
              ))}
            </FilterGroup>

            <FilterGroup label="Price">
              {PRICE_BUCKETS.map((p) => (
                <Chip key={p} active={filters.priceBucket === p} onClick={() => setFilters({ ...filters, priceBucket: p })}>
                  {p}
                </Chip>
              ))}
            </FilterGroup>

            <FilterGroup label="Material / Fabric">
              <Chip
                active={filters.material === "All Materials"}
                onClick={() => setFilters({ ...filters, material: "All Materials" })}
              >
                All
              </Chip>
              {MATERIALS.map((m) => (
                <Chip key={m} active={filters.material === m} onClick={() => setFilters({ ...filters, material: m })}>
                  {m}
                </Chip>
              ))}
            </FilterGroup>

            <FilterGroup label="Country">
              <Chip
                active={filters.country === "All Countries"}
                onClick={() => setFilters({ ...filters, country: "All Countries" })}
              >
                All
              </Chip>
              {COUNTRIES.map((c) => (
                <Chip key={c} active={filters.country === c} onClick={() => setFilters({ ...filters, country: c })}>
                  {c}
                </Chip>
              ))}
            </FilterGroup>

            <FilterGroup label="Supplier Type">
              {PRODUCTION_TYPES.map((t) => (
                <Chip key={t} active={filters.productionTypes.includes(t)} onClick={() => toggleProductionType(t)}>
                  {t}
                </Chip>
              ))}
            </FilterGroup>

            <div className="flex flex-col gap-1 pt-1 border-t border-border">
              <label className="flex items-center justify-between py-1.5 cursor-pointer">
                <span className="text-sm text-foreground">Verified suppliers only</span>
                <input
                  type="checkbox"
                  checked={filters.verifiedOnly}
                  onChange={(e) => setFilters({ ...filters, verifiedOnly: e.target.checked })}
                  className="w-4 h-4 accent-primary"
                />
              </label>
              <label className="flex items-center justify-between py-1.5 cursor-pointer">
                <span className="text-sm text-foreground">Ready stock</span>
                <input
                  type="checkbox"
                  checked={filters.readyStockOnly}
                  onChange={(e) => setFilters({ ...filters, readyStockOnly: e.target.checked })}
                  className="w-4 h-4 accent-primary"
                />
              </label>
              <label className="flex items-center justify-between py-1.5 cursor-pointer">
                <span className="text-sm text-foreground">Export quality</span>
                <input
                  type="checkbox"
                  checked={filters.exportOnly}
                  onChange={(e) => setFilters({ ...filters, exportOnly: e.target.checked })}
                  className="w-4 h-4 accent-primary"
                />
              </label>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {typeof resultCount === "number" && (
        <p className="text-xs text-muted-foreground mt-2">{resultCount} products</p>
      )}
    </div>
  );
}
