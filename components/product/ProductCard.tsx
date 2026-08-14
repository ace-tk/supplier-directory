"use client";

import Link from "next/link";
import { Maximize2, Pencil, MoreHorizontal, Copy, Trash2, PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/portal/status-badge";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { formatMoney } from "@/lib/invoicing/ui";
import { STATUS_OPTIONS, typeLabel, locationLabel } from "@/components/product/ProductList";
import type { CatalogRowRecord } from "@/types/catalog";

interface ProductCardProps {
  row: CatalogRowRecord;
  basePath: string;
  onDuplicate: (id: string) => void;
  onDelete: (row: CatalogRowRecord) => void;
}

/**
 * Image-focused browsing card for the Product grid view — reads the exact
 * same CatalogRowRecord the table renders, so it can never drift out of
 * sync. View/Edit reuse the table's own links; Duplicate/Delete reuse the
 * table's own handlers (passed down from ProductList).
 */
export function ProductCard({ row, basePath, onDuplicate, onDelete }: ProductCardProps) {
  const cover = row.images[0];
  const statusLabel = STATUS_OPTIONS.find((o) => o.value === row.status)?.label ?? row.status;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      <Link href={`${basePath}/${row.id}`} className="block group">
        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover.dataUrl}
              alt={row.productName}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <PackageSearch className="h-8 w-8" />
            </div>
          )}
          <div className="absolute top-2 right-2">
            <StatusBadge status={statusLabel} />
          </div>
        </div>

        <div className="p-3 pb-2 space-y-2">
          <div>
            <p className="text-sm font-semibold text-foreground truncate group-hover:underline">{row.productName}</p>
            <p className="text-xs text-muted-foreground truncate">{[row.category, row.brandName].filter(Boolean).join(" · ") || "—"}</p>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-foreground tabular-nums">{formatMoney(String(row.priceAfterGst), row.currency)}</span>
            <span className="text-xs text-muted-foreground tabular-nums">Stock: {row.quantity}</span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground shrink-0">GST: {row.gstPercent}%</span>
            <StatusBadge status={typeLabel(row)} />
          </div>

          <p className="text-xs text-muted-foreground truncate">{locationLabel(row)}</p>
        </div>
      </Link>

      <div className="mt-auto px-3 pb-3 pt-1 flex items-center gap-2">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5" render={<Link href={`${basePath}/${row.id}`} />} nativeButton={false}>
          <Maximize2 className="h-3.5 w-3.5" /> View
        </Button>
        <Button variant="outline" size="sm" className="flex-1 gap-1.5" render={<Link href={`${basePath}/${row.id}/edit`} />} nativeButton={false}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" aria-label="More actions" />}>
            <MoreHorizontal className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onDuplicate(row.id)}>
              <Copy className="h-3.5 w-3.5" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(row)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
