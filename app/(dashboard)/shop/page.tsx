"use client";

import { Suspense, useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PackageSearch, Loader2, Heart, History } from "lucide-react";
import { FeaturedSlider } from "@/components/shop/FeaturedSlider";
import { ShopCategories } from "@/components/shop/ShopCategories";
import { FilterBar, type ShopFilters, DEFAULT_FILTERS } from "@/components/shop/FilterBar";
import { AdvancedFilters, countActiveFilters } from "@/components/shop/AdvancedFilters";
import { ShopSidebar, type ShopSidebarView } from "@/components/shop/ShopSidebar";
import { MasonryGrid } from "@/components/shop/MasonryGrid";
import { ProductDrawer } from "@/components/shop/ProductDrawer";
import { ProductVideoModal } from "@/components/shop/ProductVideoModal";
import { RequestVideoModal } from "@/components/shop/RequestVideoModal";
import { CounterOfferModal } from "@/components/shop/CounterOfferModal";
import { BuyerRequirementAssistant } from "@/components/shop/BuyerRequirementAssistant";
import { SupplierDrawer } from "@/components/suppliers/supplier-drawer";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/shared/empty-state";
import { Product } from "@/types/product";
import { Supplier } from "@/types/supplier";
import { getMoqNumber, getPriceMin, isReadyStock } from "@/lib/product-tags";
import { hasProductVideo } from "@/lib/product-engagement";

const PAGE_SIZE = 24;

function ShopPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1);
  const [hasMore, setHasMore] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All Categories");
  const [activeSort, setActiveSort] = useState("Trending");
  const [filters, setFilters] = useState<ShopFilters>(DEFAULT_FILTERS);

  // Sidebar view — a pure UI-selection flag layered on top of the existing
  // category/sort/filters state, not a replacement for any of it. "saved"
  // and "recent" are placeholder-only until the dedicated DB-backed
  // follow-up lands; everything else drives the same state the page
  // already had (activeSort for Trending, a client-side predicate for
  // Video, and the existing `filters` state for Filters).
  const [activeView, setActiveView] = useState<ShopSidebarView>("explore");
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);

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
      if (activeView === "video" && !hasProductVideo(p)) return false;

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
  }, [products, activeView, filters.readyStockOnly, filters.moqBucket, filters.priceBucket, filters.productionTypes]);

  function onCategorySelect(category: string) {
    setActiveCategory(category === "All Categories" ? "All Categories" : category);
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function onSelectView(view: ShopSidebarView) {
    setActiveView(view);
    if (view === "trending") setActiveSort("Trending");
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

  const showPlaceholderPanel = activeView === "saved" || activeView === "recent";

  return (
    <div className="max-w-[1600px] mx-auto w-full flex items-start gap-6">
      <ShopSidebar
        activeView={activeView}
        onSelectView={onSelectView}
        onOpenFilters={() => setFiltersSheetOpen(true)}
        filtersActive={filtersSheetOpen}
        filterCount={countActiveFilters(filters)}
      />

      <div className="flex-1 min-w-0">
        <div className="pt-4">
          <FeaturedSlider onSlideClick={onCategorySelect} />
        </div>

        <div className="pt-8">
          <ShopCategories onSelect={onCategorySelect} />
        </div>

        <div ref={gridRef} className="pt-4 scroll-mt-4">
          <FilterBar
            resultCount={loading || showPlaceholderPanel ? undefined : visibleProducts.length}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            activeSort={activeSort}
            setActiveSort={setActiveSort}
            filters={filters}
            setFilters={setFilters}
          />

          <div className="pt-6 pb-20">
            {showPlaceholderPanel ? (
              <EmptyState
                icon={activeView === "saved" ? Heart : History}
                title={activeView === "saved" ? "Saved products — coming soon" : "Recently viewed — coming soon"}
                description={
                  activeView === "saved"
                    ? "Bookmarking products for later will be available in an upcoming update."
                    : "Products you've recently opened will show up here in an upcoming update."
                }
                action={{ label: "Back to Explore", onClick: () => setActiveView("explore") }}
              />
            ) : loading ? (
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
                <h3 className="text-2xl font-bold text-foreground mb-2">
                  {activeView === "video" ? "No video products found" : "No products found"}
                </h3>
                <p className="text-muted-foreground max-w-md">
                  {activeView === "video"
                    ? "None of the currently loaded products have a video yet. Try Explore or adjust your filters."
                    : "We couldn't find any products matching your current filters. Try adjusting your search or filters."}
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

        <BuyerRequirementAssistant />
      </div>

      <Sheet open={filtersSheetOpen} onOpenChange={setFiltersSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-sm overflow-y-auto scrollbar-thin">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            <AdvancedFilters filters={filters} setFilters={setFilters} showHeader={false} />
          </div>
        </SheetContent>
      </Sheet>

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
