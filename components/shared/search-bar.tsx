"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { OPEN_PALETTE_EVENT } from "@/components/shared/command-palette";

interface SearchBarProps {
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
}

/** Search-field look-alike that opens the Cmd/Ctrl+K command palette. */
export function SearchBar({ placeholder = "Search...", className, onFocus }: SearchBarProps) {
  return (
    <button
      type="button"
      onClick={() => {
        onFocus?.();
        window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
      }}
      className={cn(
        "group relative flex h-10 w-full items-center gap-2 rounded-xl border border-border bg-surface pl-3 pr-2 text-left text-sm",
        "text-muted-foreground outline-none transition-[border-color,box-shadow] duration-150",
        "hover:border-pri/40 focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_var(--focus-ring)]",
        className
      )}
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{placeholder}</span>
      <kbd className="hidden h-5 shrink-0 items-center rounded-md border border-border bg-soft px-1.5 font-mono text-[10px] font-medium sm:flex">
        ⌘K
      </kbd>
    </button>
  );
}
