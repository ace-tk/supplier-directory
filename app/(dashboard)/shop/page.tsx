"use client";

import { useState, useEffect } from "react";
import { FilterBar } from "@/components/shop/FilterBar";
import { MasonryGrid } from "@/components/shop/MasonryGrid";
import { ProductDrawer } from "@/components/shop/ProductDrawer";
import { Product } from "@/types/product";
import { Supplier } from "@/types/supplier";
import { motion } from "framer-motion";
import { PackageSearch } from "lucide-react";
import { SupplierDrawer } from "@/components/suppliers/supplier-drawer";

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All Categories");
  const [activeSort, setActiveSort] = useState("Trending");
  
  // Drawer
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierDrawerOpen, setSupplierDrawerOpen] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Fetch products
  useEffect(() => {
    async function fetchProducts(isLoadMore = false) {
      if (!isLoadMore) setLoading(true);
      try {
        const url = new URL("/api/products", window.location.origin);
        if (activeCategory !== "All Categories") url.searchParams.set("category", activeCategory);
        if (searchQuery) url.searchParams.set("search", searchQuery);
        if (activeSort) url.searchParams.set("sort", activeSort.toLowerCase());
        url.searchParams.set("page", isLoadMore ? page.toString() : "1");
        
        const res = await fetch(url.toString());
        const data = await res.json();
        
        if (isLoadMore) {
          setProducts(prev => [...prev, ...data]);
        } else {
          setProducts(data);
        }
        
        if (data.length < 20) setHasMore(false);
        else setHasMore(true);
      } catch (err) {
        console.error("Failed to load products:", err);
      } finally {
        setLoading(false);
      }
    }
    
    const timer = setTimeout(() => fetchProducts(page > 1), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, activeCategory, activeSort, page]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, activeCategory, activeSort]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header section */}
      <div className="pt-12 pb-8 px-4 sm:px-6 lg:px-8 max-w-[2000px] mx-auto w-full text-center sm:text-left">
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
          Shop
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl">
          Discover products from verified wholesale suppliers. Browse the latest trends and connect directly with manufacturers globally.
        </p>
      </div>

      <FilterBar 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        activeSort={activeSort}
        setActiveSort={setActiveSort}
      />

      <main className="flex-1 max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8 w-full pb-20">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium animate-pulse">Loading products...</p>
          </div>
        ) : products.length > 0 ? (
          <>
            <MasonryGrid 
              products={products} 
              onProductClick={(p) => setSelectedProduct(p)} 
            />
            {hasMore && (
              <div className="flex justify-center mt-12 mb-8">
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="px-8 py-3 bg-white border border-slate-200 text-slate-700 font-semibold rounded-full hover:bg-slate-50 hover:shadow-sm transition-all"
                >
                  Load More Products
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <PackageSearch className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">No products found</h3>
            <p className="text-slate-500 max-w-md">
              We couldn&apos;t find any products matching your current filters. Try adjusting your search or category selection.
            </p>
            <button 
              onClick={() => {
                setSearchQuery("");
                setActiveCategory("All Categories");
              }}
              className="mt-8 px-6 py-3 bg-slate-900 text-white rounded-full font-semibold hover:bg-slate-800 transition-colors"
            >
              Clear all filters
            </button>
          </div>
        )}
      </main>

      <ProductDrawer 
        product={selectedProduct} 
        isOpen={!!selectedProduct} 
        onClose={() => setSelectedProduct(null)} 
        onViewSupplier={(supplier) => {
          setSelectedSupplier(supplier);
          setSupplierDrawerOpen(true);
        }}
      />

      <SupplierDrawer
        supplier={selectedSupplier}
        open={supplierDrawerOpen}
        onOpenChange={setSupplierDrawerOpen}
        onUpdate={async () => {}}
        onDelete={async () => {}}
      />
    </div>
  );
}
