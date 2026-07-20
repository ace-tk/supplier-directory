"use client";

import { Search, Command } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
}

export function SearchBar({ placeholder = "Search...", className, onFocus }: SearchBarProps) {
  return (
    <div className={cn("relative group", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none transition-colors group-focus-within:text-foreground" />
      <input
        type="text"
        placeholder={placeholder}
        onFocus={onFocus}
        className={cn(
          "w-full h-9 pl-9 pr-12 rounded-lg text-sm",
          "bg-muted/50 border border-border/60",
          "text-foreground placeholder:text-muted-foreground",
          "outline-none transition-all duration-150",
          "focus:bg-background focus:border-ring focus:ring-1 focus:ring-ring/30",
          "hover:bg-muted/80 hover:border-border"
        )}
      />
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pointer-events-none">
        <kbd className="flex items-center justify-center h-5 px-1.5 rounded text-[10px] font-mono font-medium text-muted-foreground bg-muted border border-border/60">
          ⌘K
        </kbd>
      </div>
    </div>
  );
}
