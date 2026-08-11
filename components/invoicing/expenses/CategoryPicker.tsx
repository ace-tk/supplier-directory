"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandInput } from "@/components/ui/command";
import { listExpenseCustomCategoriesAction, createExpenseCustomCategoryAction } from "@/services/expenses";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_OPTIONS } from "@/lib/expenses/ui";
import { getCategoryColor } from "@/lib/expenses/category-colors";
import { cn } from "@/lib/utils";
import type { ExpenseCategory, ExpenseCustomCategoryOption } from "@/types/expense";

export interface CategorySelection {
  category: ExpenseCategory;
  customCategoryId: string | null;
  customCategoryLabel: string;
}

/**
 * Combobox over both the fixed system categories (enum-backed, unchanged)
 * and the owner's DB-backed custom categories, with an inline "+ Add
 * Category" for creating a new one on the fly — never a Prisma enum edit.
 */
export function CategoryPicker({ value, onChange }: { value: CategorySelection; onChange: (v: CategorySelection) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customCategories, setCustomCategories] = useState<ExpenseCustomCategoryOption[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listExpenseCustomCategoriesAction().then((r) => {
      if (r.success) setCustomCategories(r.data);
    });
  }, []);

  const isCustomSelected = value.category === "OTHER" && Boolean(value.customCategoryId);
  const selectedLabel = isCustomSelected ? value.customCategoryLabel : EXPENSE_CATEGORY_LABELS[value.category];
  const selectedColor = getCategoryColor({
    category: value.category,
    customCategoryId: value.customCategoryId,
    customCategoryLabel: value.customCategoryLabel,
  });

  const trimmedSearch = search.trim();
  const exactMatch =
    EXPENSE_CATEGORY_OPTIONS.some((c) => EXPENSE_CATEGORY_LABELS[c].toLowerCase() === trimmedSearch.toLowerCase()) ||
    customCategories.some((c) => c.name.toLowerCase() === trimmedSearch.toLowerCase());

  async function handleCreate() {
    if (!trimmedSearch || creating) return;
    setCreating(true);
    try {
      const result = await createExpenseCustomCategoryAction(trimmedSearch);
      if (!result.success) return toast.error(result.error);
      setCustomCategories((prev) => (prev.some((c) => c.id === result.data.id) ? prev : [...prev, result.data].sort((a, b) => a.name.localeCompare(b.name))));
      onChange({ category: "OTHER", customCategoryId: result.data.id, customCategoryLabel: result.data.name });
      setOpen(false);
      setSearch("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" className="w-full justify-between font-normal" />}>
        <span className="inline-flex items-center gap-1.5 truncate">
          <span className={cn("h-2 w-2 rounded-full shrink-0", selectedColor.dot)} />
          {selectedLabel}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </PopoverTrigger>
      <PopoverContent className="w-[--anchor-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search or create a category..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>No matches found.</CommandEmpty>
            <CommandGroup heading="Categories">
              {EXPENSE_CATEGORY_OPTIONS.filter((c) => EXPENSE_CATEGORY_LABELS[c].toLowerCase().includes(trimmedSearch.toLowerCase())).map(
                (c) => {
                  const color = getCategoryColor({ category: c });
                  return (
                    <CommandItem
                      key={c}
                      value={c}
                      onSelect={() => {
                        onChange({ category: c, customCategoryId: null, customCategoryLabel: "" });
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <Check className={cn("h-3.5 w-3.5", value.category === c && !isCustomSelected ? "opacity-100" : "opacity-0")} />
                      <span className={cn("h-2 w-2 rounded-full", color.dot)} />
                      {EXPENSE_CATEGORY_LABELS[c]}
                    </CommandItem>
                  );
                }
              )}
            </CommandGroup>
            {customCategories.length > 0 && (
              <CommandGroup heading="Custom Categories">
                {customCategories
                  .filter((c) => c.name.toLowerCase().includes(trimmedSearch.toLowerCase()))
                  .map((c) => {
                    const color = getCategoryColor({ category: "OTHER", customCategoryId: c.id });
                    return (
                      <CommandItem
                        key={c.id}
                        value={c.name}
                        onSelect={() => {
                          onChange({ category: "OTHER", customCategoryId: c.id, customCategoryLabel: c.name });
                          setOpen(false);
                          setSearch("");
                        }}
                      >
                        <Check className={cn("h-3.5 w-3.5", value.customCategoryId === c.id ? "opacity-100" : "opacity-0")} />
                        <span className={cn("h-2 w-2 rounded-full", color.dot)} />
                        {c.name}
                      </CommandItem>
                    );
                  })}
              </CommandGroup>
            )}
            {trimmedSearch && !exactMatch && (
              <CommandGroup>
                <CommandItem value={`create-${trimmedSearch}`} onSelect={handleCreate} disabled={creating}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Category &quot;{trimmedSearch}&quot;
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
