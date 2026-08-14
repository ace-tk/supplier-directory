"use client";

import { ProductCard } from "@/components/product/ProductCard";
import type { CatalogRowRecord } from "@/types/catalog";

interface ProductGridProps {
  rows: CatalogRowRecord[];
  basePath: string;
  onDuplicate: (id: string) => void;
  onDelete: (row: CatalogRowRecord) => void;
}

/** Same filteredRows the table renders, laid out as responsive cards. */
export function ProductGrid({ rows, basePath, onDuplicate, onDelete }: ProductGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {rows.map((row) => (
        <ProductCard key={row.id} row={row} basePath={basePath} onDuplicate={onDuplicate} onDelete={onDelete} />
      ))}
    </div>
  );
}
