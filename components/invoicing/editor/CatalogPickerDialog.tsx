"use client";

import { useEffect, useState } from "react";
import { PackageSearch } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { getCatalogRowOptionsAction } from "@/services/invoicing";
import { formatMoney } from "@/lib/invoicing/ui";
import type { CatalogRowOption } from "@/types/invoicing";

export function CatalogPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (row: CatalogRowOption) => void;
}) {
  const [rows, setRows] = useState<CatalogRowOption[] | null>(null);
  const loading = rows === null;

  useEffect(() => {
    if (!open || rows !== null) return;
    let cancelled = false;
    getCatalogRowOptionsAction().then((result) => {
      if (cancelled) return;
      if (result.success) setRows(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, rows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>Add from Catalog</DialogTitle>
        </DialogHeader>
        <Command className="rounded-none">
          <CommandInput placeholder="Search your catalog..." />
          <CommandList className="max-h-96">
            <CommandEmpty>
              {loading ? "Loading…" : "No active catalog items found."}
            </CommandEmpty>
            <CommandGroup>
              {(rows ?? []).map((row) => (
                <CommandItem
                  key={row.id}
                  value={`${row.productName} ${row.sku ?? ""}`}
                  onSelect={() => {
                    onSelect(row);
                    onOpenChange(false);
                  }}
                  className="flex items-center gap-2.5"
                >
                  {row.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.imageUrl} alt="" className="h-7 w-7 rounded object-cover shrink-0" />
                  ) : (
                    <PackageSearch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground truncate">{row.productName}</p>
                    {row.sku && <p className="text-xs text-muted-foreground truncate">SKU: {row.sku}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {formatMoney(row.priceBeforeGst, row.currency)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
