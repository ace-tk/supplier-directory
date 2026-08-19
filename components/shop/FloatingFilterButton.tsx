"use client";

import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/** Appears only once the in-page FilterBar has scrolled out of view (see
 * the IntersectionObserver in app/(dashboard)/shop/page.tsx) — never shown
 * at the same time as the bar itself. Opens the same real filter state via
 * FilterDrawer, not a second filtering system.
 *
 * Stacked above the Shop page's existing BuyerRequirementAssistant button
 * (fixed bottom-5 right-5, ~44px tall) rather than sharing its corner —
 * same right edge, enough vertical clearance that neither ever covers the
 * other's click target. */
export function FloatingFilterButton({ visible, activeCount, onClick }: { visible: boolean; activeCount: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={cn(
        "fixed bottom-24 right-5 z-30 flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-md transition-all duration-200",
        visible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
      )}
    >
      <SlidersHorizontal className="w-4 h-4" />
      Filters
      {activeCount > 0 && (
        <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px]">
          {activeCount}
        </span>
      )}
    </button>
  );
}
