"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Coffee, Moon, Sun } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { NavGroup } from "@/lib/roles";

export const OPEN_PALETTE_EVENT = "supplybase:open-command-palette";

/** Cmd/Ctrl+K palette: jump to any page the user can see, or switch theme. */
export function CommandPalette({ navGroups }: { navGroups: NavGroup[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search SupplyBase"
      description="Jump to a page or change the theme"
    >
      <Command>
        <CommandInput placeholder="Search pages…" />
        <CommandList>
          <CommandEmpty>Nothing found.</CommandEmpty>
          {navGroups.map((group) => {
            const items = group.items.filter((i) => !i.comingSoon);
            if (items.length === 0) return null;
            return (
              <CommandGroup key={group.group} heading={group.group}>
                {items.map((item) => (
                  <CommandItem
                    key={item.href + item.label}
                    value={`${group.group} ${item.label}`}
                    onSelect={() => go(item.href)}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
          <CommandSeparator />
          <CommandGroup heading="Theme">
            <CommandItem
              value="theme light"
              onSelect={() => {
                setTheme("light");
                setOpen(false);
              }}
            >
              <Sun className="h-4 w-4" /> Light theme
            </CommandItem>
            <CommandItem
              value="theme warm"
              onSelect={() => {
                setTheme("warm");
                setOpen(false);
              }}
            >
              <Coffee className="h-4 w-4" /> Warm theme
            </CommandItem>
            <CommandItem
              value="theme dark"
              onSelect={() => {
                setTheme("dark");
                setOpen(false);
              }}
            >
              <Moon className="h-4 w-4" /> Dark theme
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
