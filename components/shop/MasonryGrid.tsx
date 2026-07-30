"use client";

import { Product } from "@/types/product";
import { Supplier } from "@/types/supplier";
import { ProductCard } from "./ProductCard";

export function MasonryGrid({
  products,
  onProductClick,
  onViewSupplier,
}: {
  products: Product[];
  onProductClick: (product: Product) => void;
  onViewSupplier: (supplier: Supplier) => void;
}) {
  return (
    <div className="columns-2 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 gap-5">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onClick={onProductClick}
          onViewSupplier={onViewSupplier}
        />
      ))}
    </div>
  );
}
