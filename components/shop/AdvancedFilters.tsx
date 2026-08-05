"use client";

// Extracted from FilterBar's popover so the exact same filter controls/state
// can be reused inside the new sidebar's slide-out panel — same `filters`/
// `setFilters` state, same logic, just a second place to render it from.

import { SHOP_CITIES, DEFAULT_FILTERS, type ShopFilters } from "@/lib/shop-data";
import { cn } from "@/lib/utils";

const MATERIALS = ["Cotton", "Linen", "Silk", "Denim", "Leather", "Polyester", "Wool", "Canvas", "Rayon"];
const COUNTRIES = ["India", "Vietnam", "China"];
const MOQ_BUCKETS = ["Any", "Under 100", "100-300", "300+"] as const;
const PRICE_BUCKETS = ["Any", "Under ₹300", "₹300–₹700", "₹700–₹1500", "Above ₹1500"] as const;
const PRODUCTION_TYPES = ["Manufacturer", "Wholesaler", "OEM", "ODM"];

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

export function AdvancedFilters({
  filters,
  setFilters,
  showHeader = true,
}: {
  filters: ShopFilters;
  setFilters: (f: ShopFilters) => void;
  showHeader?: boolean;
}) {
  function toggleProductionType(type: string) {
    setFilters({
      ...filters,
      productionTypes: filters.productionTypes.includes(type)
        ? filters.productionTypes.filter((t) => t !== type)
        : [...filters.productionTypes, type],
    });
  }

  return (
    <div className="space-y-5">
      {showHeader && (
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm">Filters</h3>
          <button
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

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
    </div>
  );
}

export function countActiveFilters(f: ShopFilters): number {
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
