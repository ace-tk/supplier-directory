"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SupplierSearchProps {
  value: string;
  onChange: (val: string) => void;
  resultCount?: number;
  className?: string;
}

export function SupplierSearch({
  value,
  onChange,
  resultCount,
  className,
}: SupplierSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn("relative", className)}>
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search by company, product, industry, country..."
          className={cn(
            "w-full h-10 pl-9 pr-10 text-sm rounded-lg",
            "bg-background border border-border",
            "text-foreground placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring",
            "transition-all duration-150"
          )}
        />
        {value && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </motion.button>
        )}
      </div>

      {/* Result count hint */}
      {value && resultCount !== undefined && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute -bottom-5 left-0 text-[11px] text-muted-foreground"
        >
          {resultCount} result{resultCount !== 1 ? "s" : ""} for &ldquo;{value}&rdquo;
        </motion.p>
      )}
    </div>
  );
}
