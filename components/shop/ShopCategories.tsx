"use client";

import { motion } from "framer-motion";
import { Baby, Footprints, Gem, Home, Shirt, User, type LucideIcon } from "lucide-react";
import { SHOP_CATEGORY_CARDS } from "@/lib/shop-data";
import { IconTile, type Tone } from "@/components/ui/icon-tile";
import { cn } from "@/lib/utils";

function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
}

/** Pastel tile + icon per category (no photos). Unknown categories fall back to a generic tile. */
const CATEGORY_STYLE: Record<string, { icon: LucideIcon; tone: Tone; surface: string }> = {
  Women: { icon: Shirt, tone: "rose", surface: "from-rose" },
  Men: { icon: User, tone: "sky", surface: "from-sky" },
  "Kids Wear": { icon: Baby, tone: "butter", surface: "from-butter" },
  Accessories: { icon: Gem, tone: "lav", surface: "from-lav" },
  Footwear: { icon: Footprints, tone: "peach", surface: "from-peach" },
  "Home Textiles": { icon: Home, tone: "mint", surface: "from-mint" },
};
const FALLBACK = { icon: Shirt, tone: "sky" as Tone, surface: "from-sky" };

export function ShopCategories({ onSelect }: { onSelect: (category: string) => void }) {
  return (
    <section className="py-4">
      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mb-4">
        Shop by Category
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {SHOP_CATEGORY_CARDS.map((cat, i) => {
          const style = CATEGORY_STYLE[cat.name] ?? FALLBACK;
          return (
            <motion.button
              key={cat.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: "easeOut", delay: i * 0.04 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(cat.name)}
              className={cn(
                "group flex flex-col items-start gap-4 rounded-[20px] bg-gradient-to-br to-card p-4 text-left ring-1 ring-border outline-none",
                "transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                style.surface
              )}
            >
              <IconTile icon={style.icon} tone={style.tone} size="lg" className="bg-surface/70" />
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-semibold leading-tight text-foreground">{cat.name}</h3>
                <p className="mt-1 text-[11px] sm:text-xs leading-snug text-muted-foreground tabular-nums">
                  {formatCount(cat.supplierCount)} suppliers
                </p>
                <p className="text-[11px] sm:text-xs leading-snug text-muted-foreground tabular-nums">
                  {formatCount(cat.productCount)} products
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
