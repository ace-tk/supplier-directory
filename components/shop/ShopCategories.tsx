"use client";

import { motion } from "framer-motion";
import { SHOP_CATEGORY_CARDS } from "@/lib/shop-data";

function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
}

export function ShopCategories({ onSelect }: { onSelect: (category: string) => void }) {
  return (
    <section className="py-4">
      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mb-4">
        Shop by Category
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {SHOP_CATEGORY_CARDS.map((cat, i) => (
          <motion.button
            key={cat.name}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: i * 0.05 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(cat.name)}
            className="group relative rounded-2xl overflow-hidden aspect-3/4 text-left shadow-card"
          >
            <img
              src={cat.cover}
              alt={cat.name}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-end p-3 sm:p-4">
              <h3 className="text-white font-semibold text-sm sm:text-base leading-tight mb-1">
                {cat.name}
              </h3>
              <p className="text-white/75 text-[11px] sm:text-xs leading-snug">
                {formatCount(cat.supplierCount)} suppliers
              </p>
              <p className="text-white/75 text-[11px] sm:text-xs leading-snug">
                {formatCount(cat.productCount)} products
              </p>
            </div>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
