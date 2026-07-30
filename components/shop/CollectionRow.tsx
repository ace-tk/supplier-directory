"use client";

import { Product } from "@/types/product";
import { Supplier } from "@/types/supplier";
import { ProductCard } from "./ProductCard";

export function CollectionRow({
  title,
  emoji,
  products,
  onProductClick,
  onViewSupplier,
}: {
  title: string;
  emoji?: string;
  products: Product[];
  onProductClick: (product: Product) => void;
  onViewSupplier: (supplier: Supplier) => void;
}) {
  if (products.length === 0) return null;

  return (
    <section className="py-2">
      <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground mb-4 flex items-center gap-2">
        {emoji && <span>{emoji}</span>}
        {title}
      </h2>
      <div className="flex gap-5 overflow-x-auto hide-scrollbar pb-2 -mx-1 px-1">
        {products.map((product) => (
          <div key={product.id} className="w-[220px] sm:w-[240px] shrink-0">
            <ProductCard product={product} onClick={onProductClick} onViewSupplier={onViewSupplier} />
          </div>
        ))}
      </div>
    </section>
  );
}
