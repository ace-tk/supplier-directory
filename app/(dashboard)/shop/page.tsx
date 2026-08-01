"use client";

import { Suspense, useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PackageSearch, Loader2 } from "lucide-react";
import { ShopHero } from "@/components/shop/ShopHero";
import { ShopCategories } from "@/components/shop/ShopCategories";
import { FilterBar, type ShopFilters, DEFAULT_FILTERS } from "@/components/shop/FilterBar";
import { MasonryGrid } from "@/components/shop/MasonryGrid";
import { CollectionRow } from "@/components/shop/CollectionRow";
import { ProductDrawer } from "@/components/shop/ProductDrawer";
import { ProductVideoModal } from "@/components/shop/ProductVideoModal";
import { RequestVideoModal } from "@/components/shop/RequestVideoModal";
import { CounterOfferModal } from "@/components/shop/CounterOfferModal";
import { SourcingRequestBar } from "@/components/shop/SourcingRequestBar";
import { SupplierDrawer } from "@/components/suppliers/supplier-drawer";
import { Product } from "@/types/product";
import { Supplier } from "@/types/supplier";
import { FASHION_CATEGORIES, COLLECTIONS } from "@/lib/shop-data";
import { getMoqNumber, getPriceMin, isReadyStock } from "@/lib/product-tags";

const PAGE_SIZE = 24;

function ShopPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [discoveryPool, setDiscoveryPool] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1);
  const [hasMore, setHasMore] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All Categories");
  const [activeSort, setActiveSort] = useState("Trending");
  const [filters, setFilters] = useState<ShopFilters>(DEFAULT_FILTERS);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierDrawerOpen, setSupplierDrawerOpen] = useState(false);

  const [videoProduct, setVideoProduct] = useState<Product | null>(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [requestVideoProduct, setRequestVideoProduct] = useState<Product | null>(null);
  const [requestVideoModalOpen, setRequestVideoModalOpen] = useState(false);
  const [counterOfferProduct, setCounterOfferProduct] = useState<Product | null>(null);
  const [counterOfferModalOpen, setCounterOfferModalOpen] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);

  function buildUrl(pageNum: number) {
    const url = new URL("/api/products", window.location.origin);
    if (activeCategory !== "All Categories") url.searchParams.set("category", activeCategory);
    if (searchQuery) url.searchParams.set("search", searchQuery);
    if (activeSort) url.searchParams.set("sort", activeSort.toLowerCase());
    if (filters.city !== "All Cities") url.searchParams.set("city", filters.city);
    if (filters.verifiedOnly) url.searchParams.set("verified", "true");
    if (filters.material !== "All Materials") url.searchParams.set("material", filters.material);
    if (filters.country !== "All Countries") url.searchParams.set("country", filters.country);
    if (filters.exportOnly) url.searchParams.set("export", "true");
    url.searchParams.set("page", pageNum.toString());
    url.searchParams.set("limit", PAGE_SIZE.toString());
    return url;
  }

  const filterKey = JSON.stringify({
    searchQuery,
    activeCategory,
    activeSort,
    city: filters.city,
    verifiedOnly: filters.verifiedOnly,
    material: filters.material,
    country: filters.country,
    exportOnly: filters.exportOnly,
  });

  // Fetch page 1 whenever search/category/sort/server-side filters change.
  useEffect(() => {
    let cancelled = false;
    pageRef.current = 1;

    async function fetchFirstPage() {
      setLoading(true);
      try {
        const res = await fetch(buildUrl(1).toString());
        const data: Product[] = await res.json();
        if (cancelled) return;
        setProducts(data);
        setHasMore(data.length >= PAGE_SIZE);
      } catch (err) {
        console.error("Failed to load products:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const timer = setTimeout(fetchFirstPage, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  // Curation pool for category-agnostic homepage collections — fetched once.
  useEffect(() => {
    fetch(`/api/products?limit=150&sort=trending`)
      .then((res) => res.json())
      .then((data: Product[]) => setDiscoveryPool(data))
      .catch((err) => console.error("Failed to load discovery pool:", err));
  }, []);

  // Resume the Request Video flow after a signup/login redirect.
  useEffect(() => {
    const openId = searchParams.get("openRequestVideo");
    if (!openId) return;

    router.replace("/shop");

    fetch(`/api/products?id=${openId}`)
      .then((res) => res.json())
      .then((data: Product[]) => {
        const found = data[0];
        if (found) {
          setRequestVideoProduct(found);
          setRequestVideoModalOpen(true);
        }
      })
      .catch((err) => console.error("Failed to resume video request:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMore() {
    const nextPage = pageRef.current + 1;
    setLoadingMore(true);
    try {
      const res = await fetch(buildUrl(nextPage).toString());
      const data: Product[] = await res.json();
      setProducts((prev) => [...prev, ...data]);
      setHasMore(data.length >= PAGE_SIZE);
      pageRef.current = nextPage;
    } catch (err) {
      console.error("Failed to load more products:", err);
    } finally {
      setLoadingMore(false);
    }
  }

  // Client-side filters that don't map cleanly to a DB column (heuristic tags, buckets).
  const visibleProducts = useMemo(() => {
    return products.filter((p) => {
      if (filters.readyStockOnly && !isReadyStock(p)) return false;

      if (filters.moqBucket !== "Any") {
        const moq = getMoqNumber(p) ?? 0;
        if (filters.moqBucket === "Under 100" && !(moq < 100)) return false;
        if (filters.moqBucket === "100-300" && !(moq >= 100 && moq <= 300)) return false;
        if (filters.moqBucket === "300+" && !(moq > 300)) return false;
      }

      if (filters.priceBucket !== "Any") {
        const min = getPriceMin(p);
        if (filters.priceBucket === "Under ₹300" && !(min < 300)) return false;
        if (filters.priceBucket === "₹300–₹700" && !(min >= 300 && min < 700)) return false;
        if (filters.priceBucket === "₹700–₹1500" && !(min >= 700 && min < 1500)) return false;
        if (filters.priceBucket === "Above ₹1500" && !(min >= 1500)) return false;
      }

      if (filters.productionTypes.length > 0) {
        const supplierType = p.supplier?.supplierType;
        const effective = new Set(
          filters.productionTypes.flatMap((t) => (t === "OEM" || t === "ODM" ? ["Manufacturer"] : [t]))
        );
        if (!supplierType || !effective.has(supplierType)) return false;
      }

      return true;
    });
  }, [products, filters.readyStockOnly, filters.moqBucket, filters.priceBucket, filters.productionTypes]);

  const collections = useMemo(
    () =>
      COLLECTIONS.map((c) => ({ ...c, items: discoveryPool.filter(c.filter).slice(0, 10) })).filter(
        (c) => c.items.length > 0
      ),
    [discoveryPool]
  );

  function isChipActive(chip: string) {
    if (FASHION_CATEGORIES.includes(chip)) return activeCategory === chip;
    if (chip === "Export Quality") return filters.exportOnly;
    if (chip === "Ready Stock") return filters.readyStockOnly;
    if (chip === "MOQ <100") return filters.moqBucket === "Under 100";
    return false;
  }

  function onChipToggle(chip: string) {
    if (FASHION_CATEGORIES.includes(chip)) {
      setActiveCategory((prev) => (prev === chip ? "All Categories" : chip));
      return;
    }
    if (chip === "Export Quality") setFilters((f) => ({ ...f, exportOnly: !f.exportOnly }));
    else if (chip === "Ready Stock") setFilters((f) => ({ ...f, readyStockOnly: !f.readyStockOnly }));
    else if (chip === "MOQ <100")
      setFilters((f) => ({ ...f, moqBucket: f.moqBucket === "Under 100" ? "Any" : "Under 100" }));
  }

  function onCategorySelect(category: string) {
    setActiveCategory(category === "All Categories" ? "All Categories" : category);
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openProduct(product: Product) {
    setSelectedProduct(product);
  }

  function openSupplier(supplier: Supplier) {
    setSelectedSupplier(supplier);
    setSupplierDrawerOpen(true);
  }

  function openVideoModal(product: Product) {
    setVideoProduct(product);
    setVideoModalOpen(true);
  }

  function openRequestVideoModal(product: Product) {
    setRequestVideoProduct(product);
    setRequestVideoModalOpen(true);
  }

  function openCounterOfferModal(product: Product) {
    setCounterOfferProduct(product);
    setCounterOfferModalOpen(true);
  }

  function clearAllFilters() {
    setSearchQuery("");
    setActiveCategory("All Categories");
    setFilters(DEFAULT_FILTERS);
  }

  return (
    <div className="max-w-[1600px] mx-auto w-full">
      <ShopHero
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onChipToggle={onChipToggle}
        onCategorySelect={onCategorySelect}
        isChipActive={isChipActive}
      />

      <ShopCategories onSelect={onCategorySelect} />

      {collections.length > 0 && (
        <div className="py-10 space-y-10">
          {collections.map((c) => (
            <CollectionRow
              key={c.title}
              title={c.title}
              emoji={c.emoji}
              products={c.items}
              onProductClick={openProduct}
              onViewSupplier={openSupplier}
              onWatchVideo={openVideoModal}
              onRequestVideo={openRequestVideoModal}
              onCounterOffer={openCounterOfferModal}
            />
          ))}
        </div>
      )}

      <div ref={gridRef} className="pt-4 scroll-mt-4">
        <FilterBar
          resultCount={loading ? undefined : visibleProducts.length}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          activeSort={activeSort}
          setActiveSort={setActiveSort}
          filters={filters}
          setFilters={setFilters}
        />

        <div className="pt-6 pb-20">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-60">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-muted-foreground font-medium animate-pulse">Loading products...</p>
            </div>
          ) : visibleProducts.length > 0 ? (
            <>
              <MasonryGrid
                products={visibleProducts}
                onProductClick={openProduct}
                onViewSupplier={openSupplier}
                onWatchVideo={openVideoModal}
                onRequestVideo={openRequestVideoModal}
                onCounterOffer={openCounterOfferModal}
              />
              {hasMore && (
                <div className="flex justify-center mt-10 mb-6">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-8 py-3 bg-card border border-border text-foreground font-semibold rounded-full hover:bg-muted hover:shadow-sm transition-all disabled:opacity-50"
                  >
                    {loadingMore ? "Loading..." : "Load More Products"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
                <PackageSearch className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">No products found</h3>
              <p className="text-muted-foreground max-w-md">
                We couldn&apos;t find any products matching your current filters. Try adjusting your search or
                filters.
              </p>
              <button
                onClick={clearAllFilters}
                className="mt-8 px-6 py-3 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 transition-colors"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </div>

      <SourcingRequestBar />

      <ProductDrawer
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onViewSupplier={openSupplier}
      />

      <SupplierDrawer
        supplier={selectedSupplier}
        open={supplierDrawerOpen}
        onOpenChange={setSupplierDrawerOpen}
        onUpdate={async () => {}}
        onDelete={async () => {}}
      />

      <ProductVideoModal product={videoProduct} open={videoModalOpen} onOpenChange={setVideoModalOpen} />

      <RequestVideoModal
        product={requestVideoProduct}
        open={requestVideoModalOpen}
        onOpenChange={setRequestVideoModalOpen}
      />

      <CounterOfferModal
        product={counterOfferProduct}
        open={counterOfferModalOpen}
        onOpenChange={setCounterOfferModalOpen}
      />
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ShopPageContent />
    </Suspense>
  );
}
