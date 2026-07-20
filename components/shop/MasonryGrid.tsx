"use client";

import { Product } from "@/types/product";
import { ProductCard } from "./ProductCard";

export function MasonryGrid({ 
  products,
  columns = 4,
  onProductClick
}: { 
  products: Product[];
  columns?: number;
  onProductClick: (product: Product) => void;
}) {
  return (
    <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-6 space-y-6">
      {products.map((product) => (
        <ProductCard 
          key={product.id} 
          product={product} 
          onClick={onProductClick} 
        />
      ))}
    </div>
  );
}
