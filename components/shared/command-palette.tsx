"use client";

import { useEffect, useState } from "react";
import { Command } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

export function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => setOpen(false)}>Dashboard</CommandItem>
          <CommandItem onSelect={() => setOpen(false)}>Supplier Directory</CommandItem>
          <CommandItem onSelect={() => setOpen(false)}>CRM</CommandItem>
          <CommandItem onSelect={() => setOpen(false)}>Shop</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => setOpen(false)}>Add Supplier</CommandItem>
          <CommandItem onSelect={() => setOpen(false)}>New Contact</CommandItem>
          <CommandItem onSelect={() => setOpen(false)}>Create Order</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
