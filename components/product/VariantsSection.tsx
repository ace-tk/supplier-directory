"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SIZE_OPTIONS, GENDER_OPTIONS } from "@/lib/catalog-ui";
import { cn } from "@/lib/utils";

/** Sizes reuse CatalogRow.sizes (a plain string[] already on the model) —
 * standard chips plus any custom size the product needs. Gender is
 * optional and only meaningful for some categories, so it's never forced. */
export function VariantsSection({
  sizes,
  onSizesChange,
  gender,
  onGenderChange,
}: {
  sizes: string[];
  onSizesChange: (sizes: string[]) => void;
  gender: string;
  onGenderChange: (gender: string) => void;
}) {
  const [customSize, setCustomSize] = useState("");

  function toggleSize(size: string) {
    onSizesChange(sizes.includes(size) ? sizes.filter((s) => s !== size) : [...sizes, size]);
  }

  function addCustomSize() {
    const v = customSize.trim();
    if (!v || sizes.includes(v)) return;
    onSizesChange([...sizes, v]);
    setCustomSize("");
  }

  const customSizes = sizes.filter((s) => !(SIZE_OPTIONS as readonly string[]).includes(s));

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Sizes</Label>
        <div className="flex flex-wrap gap-1.5">
          {SIZE_OPTIONS.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => toggleSize(size)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                sizes.includes(size)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {size}
            </button>
          ))}
          {customSizes.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => toggleSize(size)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-primary text-primary-foreground border-primary"
            >
              {size}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={customSize}
            onChange={(e) => setCustomSize(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomSize();
              }
            }}
            placeholder="Custom size (e.g. 32, One Size)"
            className="h-8 text-xs"
          />
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1 shrink-0" onClick={addCustomSize}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Gender</Label>
        <Select value={gender || "__none__"} onValueChange={(v) => v && onGenderChange(v === "__none__" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Not applicable</SelectItem>
            {GENDER_OPTIONS.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
