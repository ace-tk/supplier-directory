// Fashion catalog for the Shop page — B2B wholesale apparel, footwear & accessories.

type SeedItem = {
  name: string;
  material: string;
  moqUnits: number;
  priceMin: number;
  priceMax: number;
  leadDays: number;
  country?: string;
};

type CategoryConfig = {
  category: string;
  supplierIds: string[];
  items: SeedItem[];
};

const CATEGORIES: CategoryConfig[] = [
  {
    category: "Women",
    supplierIds: ["sup-026", "sup-027"],
    items: [
      { name: "Floral Print Rayon Kurti", material: "Rayon", moqUnits: 100, priceMin: 220, priceMax: 320, leadDays: 10 },
      { name: "Georgette Anarkali Gown", material: "Georgette", moqUnits: 50, priceMin: 650, priceMax: 950, leadDays: 15 },
      { name: "Cotton Palazzo Co-ord Set", material: "Cotton", moqUnits: 100, priceMin: 380, priceMax: 540, leadDays: 12 },
      { name: "Chiffon Wrap Maxi Dress", material: "Chiffon", moqUnits: 60, priceMin: 480, priceMax: 720, leadDays: 14 },
      { name: "Denim Women's Jacket", material: "Denim", moqUnits: 150, priceMin: 550, priceMax: 780, leadDays: 18 },
      { name: "Printed Crepe Co-ord Set", material: "Crepe", moqUnits: 100, priceMin: 420, priceMax: 600, leadDays: 12 },
      { name: "Embroidered Chikan Kurti", material: "Cotton", moqUnits: 80, priceMin: 340, priceMax: 480, leadDays: 10 },
    ],
  },
  {
    category: "Men",
    supplierIds: ["sup-028", "sup-029"],
    items: [
      { name: "Cotton Formal Shirt", material: "Cotton", moqUnits: 200, priceMin: 280, priceMax: 420, leadDays: 10 },
      { name: "Linen Casual Shirt", material: "Linen", moqUnits: 150, priceMin: 350, priceMax: 520, leadDays: 12 },
      { name: "Slim Fit Chinos", material: "Cotton Twill", moqUnits: 200, priceMin: 400, priceMax: 580, leadDays: 14 },
      { name: "Men's Bomber Jacket", material: "Polyester", moqUnits: 100, priceMin: 650, priceMax: 900, leadDays: 18 },
      { name: "Polo T-Shirt Pack (Set of 5)", material: "Cotton", moqUnits: 100, priceMin: 550, priceMax: 750, leadDays: 10 },
      { name: "Nehru Jacket", material: "Silk Blend", moqUnits: 60, priceMin: 480, priceMax: 680, leadDays: 15 },
    ],
  },
  {
    category: "Kids Wear",
    supplierIds: ["sup-030"],
    items: [
      { name: "Kids Cotton Frock", material: "Cotton", moqUnits: 100, priceMin: 180, priceMax: 260, leadDays: 10 },
      { name: "Boys Denim Dungaree", material: "Denim", moqUnits: 100, priceMin: 260, priceMax: 380, leadDays: 12 },
      { name: "Girls Party Gown", material: "Net & Satin", moqUnits: 60, priceMin: 420, priceMax: 620, leadDays: 15 },
      { name: "Kids Printed T-Shirt Set (Pack of 3)", material: "Cotton", moqUnits: 150, priceMin: 320, priceMax: 460, leadDays: 8 },
      { name: "Infant Rompers Pack", material: "Cotton", moqUnits: 200, priceMin: 220, priceMax: 320, leadDays: 8 },
    ],
  },
  {
    category: "Women",
    supplierIds: ["sup-031", "sup-032", "sup-002"],
    items: [
      { name: "Banarasi Silk Saree", material: "Silk", moqUnits: 30, priceMin: 1200, priceMax: 2400, leadDays: 20 },
      { name: "Embroidered Bridal Lehenga", material: "Silk & Net", moqUnits: 20, priceMin: 3500, priceMax: 6800, leadDays: 25 },
      { name: "Block Print Cotton Saree", material: "Cotton", moqUnits: 50, priceMin: 480, priceMax: 720, leadDays: 14 },
      { name: "Bandhani Silk Dupatta", material: "Silk", moqUnits: 100, priceMin: 220, priceMax: 380, leadDays: 10 },
      { name: "Chikankari Kurta Set", material: "Cotton", moqUnits: 80, priceMin: 380, priceMax: 560, leadDays: 12 },
      { name: "Handloom Cotton Saree", material: "Handloom Cotton", moqUnits: 40, priceMin: 650, priceMax: 980, leadDays: 16 },
    ],
  },
  {
    category: "Women",
    supplierIds: ["sup-033", "sup-027"],
    items: [
      { name: "Skinny Fit Denim Jeans", material: "Denim", moqUnits: 150, priceMin: 420, priceMax: 620, leadDays: 14 },
      { name: "Bodycon Party Dress", material: "Lycra", moqUnits: 80, priceMin: 480, priceMax: 680, leadDays: 12 },
      { name: "Crop Top & Skirt Set", material: "Cotton Lycra", moqUnits: 100, priceMin: 380, priceMax: 540, leadDays: 10 },
      { name: "Oversized Denim Jacket", material: "Denim", moqUnits: 100, priceMin: 620, priceMax: 880, leadDays: 16 },
      { name: "Formal Blazer Set", material: "Polyester Viscose", moqUnits: 60, priceMin: 850, priceMax: 1200, leadDays: 18 },
      { name: "Satin Jumpsuit", material: "Satin", moqUnits: 70, priceMin: 520, priceMax: 740, leadDays: 12 },
    ],
  },
  {
    category: "Men",
    supplierIds: ["sup-034"],
    items: [
      { name: "Men's Track Suit", material: "Polyester", moqUnits: 100, priceMin: 480, priceMax: 680, leadDays: 12 },
      { name: "Performance Running Shorts", material: "Polyester", moqUnits: 150, priceMin: 220, priceMax: 340, leadDays: 8 },
      { name: "Gym T-Shirt Pack (Pack of 5)", material: "Dri-Fit Polyester", moqUnits: 100, priceMin: 650, priceMax: 880, leadDays: 10 },
      { name: "Sports Zipper Hoodie", material: "Fleece", moqUnits: 80, priceMin: 580, priceMax: 820, leadDays: 14 },
    ],
  },
  {
    category: "Women",
    supplierIds: ["sup-034"],
    items: [
      { name: "Women's Yoga Set", material: "Nylon Spandex", moqUnits: 100, priceMin: 420, priceMax: 620, leadDays: 10 },
      { name: "Compression Leggings", material: "Nylon Spandex", moqUnits: 120, priceMin: 380, priceMax: 540, leadDays: 10 },
    ],
  },
  {
    category: "Footwear",
    supplierIds: ["sup-035", "sup-036"],
    items: [
      { name: "Men's Leather Loafers", material: "Genuine Leather", moqUnits: 50, priceMin: 850, priceMax: 1200, leadDays: 20 },
      { name: "Women's Block Heel Sandals", material: "Synthetic Leather", moqUnits: 60, priceMin: 620, priceMax: 880, leadDays: 16 },
      { name: "Kids Sports Shoes", material: "Mesh & Rubber", moqUnits: 100, priceMin: 380, priceMax: 560, leadDays: 14, country: "Vietnam" },
      { name: "Ethnic Embroidered Juttis", material: "Leather & Textile", moqUnits: 50, priceMin: 420, priceMax: 640, leadDays: 12 },
      { name: "Canvas Casual Sneakers", material: "Canvas", moqUnits: 100, priceMin: 480, priceMax: 680, leadDays: 14, country: "China" },
      { name: "Men's Formal Leather Sandals", material: "Leather", moqUnits: 50, priceMin: 550, priceMax: 780, leadDays: 16 },
    ],
  },
  {
    category: "Home Textiles",
    supplierIds: ["sup-037"],
    items: [
      { name: "Cotton Double Bedsheet Set", material: "Cotton", moqUnits: 100, priceMin: 480, priceMax: 680, leadDays: 12 },
      { name: "Printed Window Curtains (Pair)", material: "Polyester", moqUnits: 100, priceMin: 380, priceMax: 540, leadDays: 10 },
      { name: "Cushion Cover Set (Set of 5)", material: "Cotton Linen", moqUnits: 150, priceMin: 320, priceMax: 460, leadDays: 10 },
      { name: "Woolen Blanket", material: "Wool Blend", moqUnits: 80, priceMin: 650, priceMax: 950, leadDays: 18 },
      { name: "Table Linen Set", material: "Cotton", moqUnits: 100, priceMin: 280, priceMax: 420, leadDays: 10 },
      { name: "Egyptian Cotton Bath Towel Set", material: "Egyptian Cotton", moqUnits: 100, priceMin: 550, priceMax: 780, leadDays: 14 },
    ],
  },
  {
    category: "Accessories",
    supplierIds: ["sup-038", "sup-039"],
    items: [
      { name: "Embroidered Leather Handbag", material: "Leather", moqUnits: 50, priceMin: 650, priceMax: 980, leadDays: 16 },
      { name: "Beaded Statement Necklace Set", material: "Metal & Beads", moqUnits: 100, priceMin: 180, priceMax: 320, leadDays: 10 },
      { name: "Silk Printed Scarves", material: "Silk", moqUnits: 100, priceMin: 220, priceMax: 380, leadDays: 10 },
      { name: "Canvas Tote Bag", material: "Canvas", moqUnits: 150, priceMin: 250, priceMax: 380, leadDays: 8 },
      { name: "Oxidised Silver Jhumka Earrings", material: "Oxidised Metal", moqUnits: 100, priceMin: 150, priceMax: 280, leadDays: 8 },
      { name: "Woven Leather Belt", material: "Leather", moqUnits: 100, priceMin: 220, priceMax: 360, leadDays: 10 },
    ],
  },
];

const IMAGE_HEIGHTS = [720, 780, 840, 900, 960, 1020, 1080, 700, 860, 940];

function padId(n: number): string {
  return `prod-${String(n).padStart(3, "0")}`;
}

let counter = 1;
let imgSeed = 1;

export const PRODUCTS = CATEGORIES.flatMap((cat) =>
  cat.items.map((item, i) => {
    const supplierId = cat.supplierIds[i % cat.supplierIds.length];
    const id = padId(counter++);
    const height = IMAGE_HEIGHTS[imgSeed % IMAGE_HEIGHTS.length];
    const seed = `fashion-${imgSeed++}`;
    const savedCount = 60 + ((imgSeed * 41 + item.name.length * 7) % 560);

    return {
      id,
      supplierId,
      name: item.name,
      description: `${item.name} — premium ${item.material.toLowerCase()} piece from a trusted wholesale ${cat.category.toLowerCase()} manufacturer. Bulk and export orders welcome, custom sizing and private-label branding available on request.`,
      moq: `${item.moqUnits} pcs`,
      priceRange: `₹${item.priceMin} - ₹${item.priceMax}`,
      category: cat.category,
      material: item.material,
      specifications: "Export-quality finishing with strict QC at every stage. Custom sizing, colorways, and packaging available for bulk orders.",
      country: item.country ?? "India",
      leadTime: `${item.leadDays} Days`,
      images: [
        `https://picsum.photos/seed/${seed}/600/${height}`,
        `https://picsum.photos/seed/${seed}-b/600/600`,
      ],
      savedCount,
    };
  })
);
