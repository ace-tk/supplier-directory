import { Product } from "@/types/product";
import { isExportQuality } from "@/lib/product-tags";
import { fashionImageUrl } from "@/lib/fashion-images";

export const SHOP_CATEGORY_CHIPS = [
  "Women",
  "Men",
  "Kids Wear",
  "Accessories",
  "Footwear",
  "Home Textiles",
  "Export Quality",
  "Ready Stock",
  "MOQ <100",
] as const;

export const FASHION_CATEGORIES = [
  "Women",
  "Men",
  "Kids Wear",
  "Accessories",
  "Footwear",
  "Home Textiles",
];

export const SHOP_CITIES = [
  "Mumbai",
  "Nagpur",
  "Surat",
  "Jaipur",
  "Tiruppur",
  "Delhi",
  "Ludhiana",
  "Bengaluru",
];

export const TRENDING_SEARCHES = [
  "cotton kurtis wholesale",
  "export quality footwear",
  "banarasi silk sarees",
  "MOQ 50 ethnic wear",
  "sustainable fabric suppliers",
  "kids winter wear",
  "premium leather bags",
  "yoga wear manufacturers",
];

export const SHOP_CATEGORY_CARDS = [
  { name: "Women", cover: fashionImageUrl("Women", "cat-women", 700, 840), supplierCount: 1420, productCount: 18300 },
  { name: "Men", cover: fashionImageUrl("Men", "cat-men", 700, 840), supplierCount: 980, productCount: 12750 },
  { name: "Kids Wear", cover: fashionImageUrl("Kids Wear", "cat-kids", 700, 840), supplierCount: 640, productCount: 7200 },
  { name: "Accessories", cover: fashionImageUrl("Accessories", "cat-accessories", 700, 840), supplierCount: 810, productCount: 9600 },
  { name: "Footwear", cover: fashionImageUrl("Footwear", "cat-footwear", 700, 840), supplierCount: 560, productCount: 6100 },
  { name: "Home Textiles", cover: fashionImageUrl("Home Textiles", "cat-hometextiles", 700, 840), supplierCount: 720, productCount: 8400 },
];

export const FEATURED_SLIDES = [
  {
    title: "Festive Collection",
    subtitle: "Handpicked ethnic wear & sarees for the wedding season",
    image: fashionImageUrl("Women", "slide-festive", 1600, 700),
    cta: "Explore Festive",
    category: "Women",
  },
  {
    title: "Summer Collection",
    subtitle: "Breathable cottons and linens, ready to ship",
    image: fashionImageUrl("Women", "slide-summer", 1600, 700),
    cta: "Shop Summer",
    category: "Women",
  },
  {
    title: "New Arrivals",
    subtitle: "Fresh drops from verified manufacturers this week",
    image: fashionImageUrl("All", "slide-new", 1600, 700),
    cta: "See What's New",
    category: "All Categories",
  },
  {
    title: "Export Quality",
    subtitle: "International-grade sourcing from top-rated exporters",
    image: fashionImageUrl("All", "slide-export", 1600, 700),
    cta: "Browse Export Picks",
    category: "All Categories",
  },
  {
    title: "Premium Manufacturers",
    subtitle: "Direct from verified factories, no middlemen",
    image: fashionImageUrl("All", "slide-premium", 1600, 700),
    cta: "Meet Manufacturers",
    category: "All Categories",
  },
  {
    title: "Trending Women's Wear",
    subtitle: "The season's most saved styles, in bulk",
    image: fashionImageUrl("Women", "slide-trending-women", 1600, 700),
    cta: "Shop Trending",
    category: "Women",
  },
  {
    title: "Kids Collection",
    subtitle: "Soft, safe, skin-friendly fabrics for little ones",
    image: fashionImageUrl("Kids Wear", "slide-kids", 1600, 700),
    cta: "Shop Kids",
    category: "Kids Wear",
  },
  {
    title: "Footwear Deals",
    subtitle: "Wholesale pricing on loafers, heels & sneakers",
    image: fashionImageUrl("Footwear", "slide-footwear", 1600, 700),
    cta: "Shop Footwear",
    category: "Footwear",
  },
];

export type Collection = {
  title: string;
  emoji: string;
  filter: (product: Product) => boolean;
};

export const COLLECTIONS: Collection[] = [
  { title: "Trending Today", emoji: "🔥", filter: (p) => p.savedCount > 320 },
  {
    title: "Women's Ethnic",
    emoji: "✨",
    filter: (p) => p.category === "Women" && /saree|lehenga|dupatta|kurta|kurti/i.test(p.name),
  },
  { title: "Luxury Bags", emoji: "👜", filter: (p) => p.category === "Accessories" && !!p.material?.includes("Leather") },
  { title: "Kids Collection", emoji: "🧸", filter: (p) => p.category === "Kids Wear" },
  { title: "Premium Footwear", emoji: "👟", filter: (p) => p.category === "Footwear" },
  { title: "Home Textile Picks", emoji: "🏠", filter: (p) => p.category === "Home Textiles" },
  { title: "Export Collection", emoji: "🌍", filter: (p) => isExportQuality(p) },
  {
    title: "Summer Essentials",
    emoji: "☀️",
    filter: (p) => !!p.material && /cotton|linen/i.test(p.material),
  },
  {
    title: "Wedding Collection",
    emoji: "💍",
    filter: (p) => /lehenga|bridal|banarasi|silk saree/i.test(p.name),
  },
];
