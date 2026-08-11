"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandInput } from "@/components/ui/command";
import { cn } from "@/lib/utils";

/**
 * Searchable "select or type a new one" combobox over a plain string field
 * (Category, Warehouse — neither is a Prisma enum, so "creating" a new
 * option just means using a new string value; nothing else to persist).
 */
export function TextCombobox({
  value,
  onChange,
  options,
  placeholder,
  addLabel = "Add",
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  addLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const trimmed = search.trim();
  const filtered = options.filter((o) => o.toLowerCase().includes(trimmed.toLowerCase()));
  const exactMatch = options.some((o) => o.toLowerCase() === trimmed.toLowerCase());

  function select(v: string) {
    onChange(v);
    setOpen(false);
    setSearch("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button type="button" variant="outline" className="w-full justify-between font-normal" />}>
        <span className="truncate">{value || placeholder}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </PopoverTrigger>
      <PopoverContent className="w-[--anchor-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={`Search or create...`} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>No matches found.</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem value="__clear__" onSelect={() => select("")}>
                  <Check className={cn("h-3.5 w-3.5", "opacity-0")} />
                  <span className="text-muted-foreground">Clear</span>
                </CommandItem>
              )}
              {filtered.map((o) => (
                <CommandItem key={o} value={o} onSelect={() => select(o)}>
                  <Check className={cn("h-3.5 w-3.5", value === o ? "opacity-100" : "opacity-0")} />
                  {o}
                </CommandItem>
              ))}
            </CommandGroup>
            {trimmed && !exactMatch && (
              <CommandGroup>
                <CommandItem value={`create-${trimmed}`} onSelect={() => select(trimmed)}>
                  <Plus className="h-3.5 w-3.5" />
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
