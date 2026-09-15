"use client";

import { useMemo, useState } from "react";
import { Check, Palette, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { searchPantoneColors, listPantoneFamilies } from "@/lib/pantone/search";
import type { PantoneColor, PantoneFamily } from "@/lib/pantone/types";
import type { ThreadColor } from "@/lib/embroidery-production";

/**
 * Opens over the existing Thread Colors panel — selecting/deselecting a
 * shade here writes straight into the same threadColors state the rest of
 * the editor (AI regeneration, production spec, save/reload) already reads.
 * No parallel selection state.
 */
export function PantoneShadePicker({
  selected,
  onAdd,
  onRemove,
  disabled,
}: {
  selected: ThreadColor[];
  onAdd: (color: PantoneColor) => void;
  onRemove: (pantoneCode: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<PantoneFamily | "All">("All");

  const families = useMemo(() => listPantoneFamilies(), []);
  const results = useMemo(() => searchPantoneColors(query, family), [query, family]);
  const selectedCodes = useMemo(() => new Set(selected.map((c) => c.pantoneCode).filter((c): c is string => Boolean(c))), [selected]);

  function toggle(color: PantoneColor) {
    if (selectedCodes.has(color.code)) {
      onRemove(color.code);
    } else if (!disabled) {
      onAdd(color);
    }
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)} className="text-primary">
        <Palette className="w-3.5 h-3.5" /> Add Pantone Shade
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Pantone Shade Picker</DialogTitle>
            <DialogDescription>
              Curated PANTONE® FHI / TCX textile shades. Screen colors are digital approximations, not certified physical matches.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by Pantone code or shade name…"
                className="pl-8"
              />
            </div>

            {families.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <FilterChip label="All" active={family === "All"} onClick={() => setFamily("All")} />
                {families.map((f) => (
                  <FilterChip key={f} label={f} active={family === f} onClick={() => setFamily(f)} />
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto scrollbar-thin p-0.5">
              {results.map((color) => {
                const isSelected = selectedCodes.has(color.code);
                const isDisabled = !isSelected && disabled;
                return (
                  <button
                    key={color.code}
                    type="button"
                    onClick={() => toggle(color)}
                    aria-pressed={isSelected}
                    disabled={isDisabled}
                    title={`${color.code} ${color.suffix} — ${color.name}`}
                    className={cn(
                      "rounded-lg border overflow-hidden text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      isSelected ? "border-primary ring-1 ring-primary" : "border-border hover:border-foreground/30",
                      isDisabled && "opacity-40 pointer-events-none"
                    )}
                  >
                    <div className="relative h-14 w-full" style={{ backgroundColor: color.hex }}>
                      {isSelected && (
                        <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 rounded-full bg-background text-primary">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div className="px-2 py-1.5 bg-card">
                      <p className="text-[11px] font-medium text-foreground truncate">
                        {color.code} {color.suffix}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{color.name}</p>
                    </div>
                  </button>
                );
              })}
              {results.length === 0 && <p className="col-span-full py-8 text-center text-xs text-muted-foreground">No shades match your search.</p>}
            </div>

            <div className="flex items-center justify-between pt-1">
              <Badge variant="secondary" className="border-0 text-[10px]">
                {selectedCodes.size} selected
              </Badge>
              <Button size="sm" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
