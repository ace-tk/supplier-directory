"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PORTAL_CATEGORIES } from "@/types/portal";

const CATEGORY_ICONS: Record<string, string> = {
  Men: "👔", Women: "👗", Kids: "🧒", Footwear: "👟", Bags: "👜",
  Accessories: "💍", Electronics: "📱", Furniture: "🛋️", Food: "🍎",
  Medical: "🏥", Industrial: "🏭", Packaging: "📦", Agriculture: "🌾",
  Beauty: "💄", Sports: "⚽",
};

interface CategorySelectorProps {
  selected: string[];
  onChange: (categories: string[]) => void;
}

export function CategorySelector({ selected, onChange }: CategorySelectorProps) {
  function toggle(cat: string) {
    onChange(
      selected.includes(cat)
        ? selected.filter((c) => c !== cat)
        : [...selected, cat]
    );
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-6">
        Select all categories that apply to your business. You can choose multiple.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {PORTAL_CATEGORIES.map((cat, i) => {
          const isSelected = selected.includes(cat);
          return (
            <motion.button
              key={cat}
              type="button"
              onClick={() => toggle(cat)}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
              whileHover={{ scale: 1.03, transition: { duration: 0.1 } }}
              whileTap={{ scale: 0.97 }}
              className={cn(
                "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer text-center",
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
              )}
            >
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                >
                  <Check className="h-3 w-3 text-primary-foreground" />
                </motion.div>
              )}
              <span className="text-2xl">{CATEGORY_ICONS[cat] ?? "📌"}</span>
              <span
                className={cn(
                  "text-xs font-medium leading-tight",
                  isSelected ? "text-primary" : "text-foreground"
                )}
              >
                {cat}
              </span>
            </motion.button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 flex flex-wrap gap-2 items-center"
        >
          <span className="text-xs text-muted-foreground">Selected:</span>
          {selected.map((cat) => (
            <span
              key={cat}
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20"
            >
              {CATEGORY_ICONS[cat]} {cat}
            </span>
          ))}
        </motion.div>
      )}
    </div>
  );
}
