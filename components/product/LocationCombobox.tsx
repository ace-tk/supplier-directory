"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandInput } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { LocationOption } from "@/services/locations";

/**
 * Searchable "select or create" combobox over a real, persisted {id,name}
 * record (Warehouse or RetailStore) — unlike TextCombobox (Category/legacy
 * Warehouse string), the value here is always a real record id, and
 * "creating" actually persists a new row via `onCreate`.
 */
export function LocationCombobox({
  value,
  options,
  onSelect,
  onCreate,
  placeholder,
  addLabel = "Add",
}: {
  value: string | null;
  options: LocationOption[];
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<{ success: boolean; data?: LocationOption; error?: string }>;
  placeholder: string;
  addLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const trimmed = search.trim();
  const filtered = options.filter((o) => o.name.toLowerCase().includes(trimmed.toLowerCase()));
  const exactMatch = options.some((o) => o.name.toLowerCase() === trimmed.toLowerCase());
  const selected = options.find((o) => o.id === value);

  function select(id: string) {
    onSelect(id);
    setOpen(false);
    setSearch("");
  }

  async function handleCreate() {
    setCreating(true);
    const result = await onCreate(trimmed);
    setCreating(false);
    if (!result.success) return toast.error(result.error ?? "Couldn't create that.");
    setOpen(false);
    setSearch("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button type="button" variant="outline" className="w-full justify-between font-normal" />}>
        <span className="truncate">{selected?.name || placeholder}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </PopoverTrigger>
      <PopoverContent className="w-[--anchor-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search or create..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>No matches found.</CommandEmpty>
            <CommandGroup>
              {filtered.map((o) => (
                <CommandItem key={o.id} value={o.id} onSelect={() => select(o.id)}>
                  <Check className={cn("h-3.5 w-3.5", value === o.id ? "opacity-100" : "opacity-0")} />
                  {o.name}
                </CommandItem>
              ))}
            </CommandGroup>
            {trimmed && !exactMatch && (
              <CommandGroup>
                <CommandItem value={`create-${trimmed}`} disabled={creating} onSelect={handleCreate}>
                  {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  {addLabel} &quot;{trimmed}&quot;
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
