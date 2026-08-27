"use client";

import { Box, RefreshCw, CircleMinus, Grid2x2, Image as ImageIcon, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

export type EditTool = "change" | "regenerate" | "remove" | "patterns" | "prints-logos" | "colorize";

const TOOLS: { key: EditTool; label: string; icon: typeof Box }[] = [
  { key: "change", label: "Change", icon: Box },
  { key: "regenerate", label: "Regenerate", icon: RefreshCw },
  { key: "remove", label: "Remove", icon: CircleMinus },
  { key: "patterns", label: "Patterns", icon: Grid2x2 },
  { key: "prints-logos", label: "Prints/Logos", icon: ImageIcon },
  { key: "colorize", label: "Colorize", icon: Palette },
];

export function EditorSidebar({ active, onSelect }: { active: EditTool; onSelect: (tool: EditTool) => void }) {
  return (
    <nav className="flex flex-col items-center gap-4 px-2 py-5">
      {TOOLS.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onSelect(t.key)}
            className={cn(
              "relative flex flex-col items-center gap-1.5 w-16 py-1.5 rounded-lg transition-colors",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {isActive && <span className="absolute -left-2 top-0 bottom-0 w-0.5 rounded-full bg-primary" />}
            <t.icon className="w-5 h-5" />
            <span className="text-[11px] font-medium leading-tight text-center">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
