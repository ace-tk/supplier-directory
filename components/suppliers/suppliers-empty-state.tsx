"use client";

import { motion } from "framer-motion";
import { Building2, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuppliersEmptyStateProps {
  hasSearch: boolean;
  onReset: () => void;
}

export function SuppliersEmptyState({ hasSearch, onReset }: SuppliersEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center text-center py-20 px-6"
    >
      {/* Illustration */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
          {hasSearch ? (
            <SearchX className="h-9 w-9 text-muted-foreground" />
          ) : (
            <Building2 className="h-9 w-9 text-muted-foreground" />
          )}
        </div>
        {/* Decorative dots */}
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary/30" />
        <div className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full bg-primary/20" />
      </div>

      <h3 className="text-base font-semibold text-foreground mb-2">
        {hasSearch ? "No suppliers found" : "No suppliers yet"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6 leading-relaxed">
        {hasSearch
          ? "Try adjusting your search terms or clearing filters to see more results."
          : "Suppliers will appear here once they are added to the directory."}
      </p>

      {hasSearch && (
        <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5">
          <SearchX className="h-3.5 w-3.5" />
          Reset Filters
        </Button>
      )}
    </motion.div>
  );
}
