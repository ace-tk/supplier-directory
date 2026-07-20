"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, LayoutGrid, List, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SupplierCard } from "@/components/suppliers/supplier-card";
import { SupplierListItem } from "@/components/suppliers/supplier-list-item";
import { SupplierFilters } from "@/components/suppliers/supplier-filters";
import { SupplierSearch } from "@/components/suppliers/supplier-search";
import { SkeletonCard, SkeletonListItem } from "@/components/suppliers/skeleton-card";
import { SuppliersEmptyState } from "@/components/suppliers/suppliers-empty-state";
import { SUPPLIERS } from "@/data/suppliers";
import { useDebounce } from "@/hooks/use-debounce";
import { type FilterKey } from "@/types/supplier";
import { cn } from "@/lib/utils";

type ViewMode = "grid" | "list";

export default function DirectoryPage() {
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<FilterKey[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [loading, setLoading] = useState(true);

  const debouncedSearch = useDebounce(search, 250);

  // Simulate initial load
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  const toggleFilter = (key: FilterKey) => {
    setActiveFilters((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  };

  const clearFilters = () => {
    setActiveFilters([]);
    setSearch("");
  };

  const filtered = useMemo(() => {
    let result = SUPPLIERS;

    // Text search
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (s) =>
          s.companyName.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.industry.toLowerCase().includes(q) ||
          s.country.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q) ||
          s.products.some((p) => p.toLowerCase().includes(q))
      );
    }

    // Filter chips
    if (activeFilters.length > 0) {
      result = result.filter((s) => {
        return activeFilters.every((f) => {
          if (f === "verified") return s.verified;
          if (f === "Manufacturer" || f === "Exporter" || f === "Wholesaler")
            return s.supplierType === f;
          if (f === "India" || f === "China" || f === "USA" || f === "Germany" || f === "Turkey")
            return s.country === f;
          if (
            f === "Electronics" ||
            f === "Textiles" ||
            f === "Food & Beverage" ||
            f === "Furniture" ||
            f === "Automotive"
          )
            return s.industry === f;
          return true;
        });
      });
    }

    return result;
  }, [debouncedSearch, activeFilters]);

  const hasActiveQuery = debouncedSearch.trim().length > 0 || activeFilters.length > 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Supplier Directory
            </h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            Discover verified manufacturers and exporters from around the world.
          </p>
        </div>

        <Button size="sm" className="gap-1.5 shrink-0 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          Add Supplier
        </Button>
      </motion.div>

      {/* Stats strip */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        {[
          { label: "Total Suppliers", value: SUPPLIERS.length },
          {
            label: "Verified",
            value: SUPPLIERS.filter((s) => s.verified).length,
            accent: "text-emerald-600 dark:text-emerald-400",
          },
          { label: "Countries", value: new Set(SUPPLIERS.map((s) => s.country)).size },
          { label: "Industries", value: new Set(SUPPLIERS.map((s) => s.industry)).size },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-card border border-border px-4 py-3"
          >
            <p className="text-xs text-muted-foreground mb-0.5">{stat.label}</p>
            <p className={cn("text-xl font-semibold tabular-nums", stat.accent ?? "text-foreground")}>
              {stat.value}
            </p>
          </div>
        ))}
      </motion.div>

      {/* Search + view toggle row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="flex items-center gap-3"
      >
        <SupplierSearch
          value={search}
          onChange={setSearch}
          resultCount={hasActiveQuery ? filtered.length : undefined}
          className="flex-1"
        />

        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 shrink-0">
          {(["grid", "list"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                "relative flex items-center justify-center w-8 h-8 rounded-md transition-colors text-muted-foreground hover:text-foreground",
                viewMode === mode && "bg-background shadow-sm text-foreground"
              )}
              aria-label={mode === "grid" ? "Grid view" : "List view"}
            >
              {mode === "grid" ? (
                <LayoutGrid className="h-4 w-4" />
              ) : (
                <List className="h-4 w-4" />
              )}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
      >
        <SupplierFilters
          activeFilters={activeFilters}
          onToggle={toggleFilter}
          onClear={clearFilters}
        />
      </motion.div>

      {/* Result count */}
      {!loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between"
        >
          <p className="text-xs text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">{filtered.length}</span>{" "}
            of {SUPPLIERS.length} suppliers
          </p>
        </motion.div>
      )}

      {/* Grid / List */}
      {loading ? (
        <div
          className={cn(
            viewMode === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              : "flex flex-col gap-3"
          )}
        >
          {Array.from({ length: 6 }).map((_, i) =>
            viewMode === "grid" ? (
              <SkeletonCard key={i} />
            ) : (
              <SkeletonListItem key={i} />
            )
          )}
        </div>
      ) : filtered.length === 0 ? (
        <SuppliersEmptyState
          hasSearch={hasActiveQuery}
          onReset={clearFilters}
        />
      ) : (
        <AnimatePresence mode="popLayout">
          {viewMode === "grid" ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {filtered.map((supplier, i) => (
                <SupplierCard
                  key={supplier.id}
                  supplier={supplier}
                  delay={Math.min(i * 0.04, 0.3)}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-3"
            >
              {filtered.map((supplier, i) => (
                <SupplierListItem
                  key={supplier.id}
                  supplier={supplier}
                  delay={Math.min(i * 0.03, 0.2)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
