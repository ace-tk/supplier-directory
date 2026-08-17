"use client";

import { Product } from "@/types/product";
import { Supplier } from "@/types/supplier";
import { ProductCard } from "./ProductCard";

export function MasonryGrid({
  products,
  onProductClick,
  onViewSupplier,
  onWatchVideo,
  onRequestVideo,
  onCounterOffer,
  savedProductIds,
  onToggleSave,
}: {
  products: Product[];
  onProductClick: (product: Product) => void;
  onViewSupplier: (supplier: Supplier) => void;
  onWatchVideo: (product: Product) => void;
  onRequestVideo: (product: Product) => void;
  onCounterOffer: (product: Product, initialStep: "terms" | "offer") => void;
  savedProductIds: Set<string>;
  onToggleSave: (product: Product) => void;
}) {
  return (
    <div className="columns-2 md:columns-3 lg:columns-4 gap-6">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onClick={onProductClick}
          onViewSupplier={onViewSupplier}
          onWatchVideo={onWatchVideo}
          onRequestVideo={onRequestVideo}
          onCounterOffer={onCounterOffer}
          isSaved={savedProductIds.has(product.id)}
          onToggleSave={onToggleSave}
        />
      ))}
    </div>
  );
}
