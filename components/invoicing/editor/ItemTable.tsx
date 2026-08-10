"use client";

import { useState } from "react";
import { Plus, Trash2, Copy, ChevronUp, ChevronDown, PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CatalogPickerDialog } from "./CatalogPickerDialog";
import { emptyItem, newItemKey, type EditorItemState } from "./types";
import { invoiceFamily } from "@/lib/invoicing/family";
import type { InvoiceType } from "@/types/invoicing";
import type { CalcInvoiceResult } from "@/lib/invoicing/calc";

export function ItemTable({
  type,
  items,
  calc,
  onChange,
  locked = false,
}: {
  type: InvoiceType;
  items: EditorItemState[];
  calc: CalcInvoiceResult;
  onChange: (items: EditorItemState[]) => void;
  /** Adjustment documents (Credit Note/Sales Return/Debit Note) only allow
   * editing Quantity and Rate on inherited line items — everything else
   * (item identity, add/remove/reorder, catalog picker) is locked. */
  locked?: boolean;
}) {
  const [catalogOpen, setCatalogOpen] = useState(false);

  function updateItem(index: number, patch: Partial<EditorItemState>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeItem(index: number) {
    if (items.length === 1) return;
    onChange(items.filter((_, i) => i !== index));
  }

  function duplicateItem(index: number) {
    const copy = { ...items[index], key: newItemKey() };
    onChange([...items.slice(0, index + 1), copy, ...items.slice(index + 1)]);
  }

  function moveItem(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-foreground">Items{locked && " (inherited — only Qty & Rate editable)"}</h2>
        {!locked && invoiceFamily(type) === "SALES" && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCatalogOpen(true)}>
            <PackageSearch className="h-3.5 w-3.5" /> Add from Catalog
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {items.map((item, i) => {
          const c = calc.items[i];
          return (
            <div key={item.key} className="rounded-xl border border-border p-3 space-y-2.5">
              <div className="flex items-start gap-2">
                <div className="flex-1 grid sm:grid-cols-2 gap-2">
                  <Input
                    value={item.productName}
                    onChange={(e) => updateItem(i, { productName: e.target.value })}
                    placeholder="Item / Product name"
                    className="font-medium"
                    disabled={locked}
                  />
                  <Input
                    value={item.hsnSac}
                    onChange={(e) => updateItem(i, { hsnSac: e.target.value })}
                    placeholder="HSN/SAC (optional)"
                    disabled={locked}
                  />
                </div>
                {!locked && (
                  <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Move up"
                      disabled={i === 0}
                      onClick={() => moveItem(i, -1)}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Move down"
                      disabled={i === items.length - 1}
                      onClick={() => moveItem(i, 1)}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Duplicate item" onClick={() => duplicateItem(i)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete item"
                      className="text-muted-foreground hover:text-destructive"
                      disabled={items.length === 1}
                      onClick={() => removeItem(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              <Input
                value={item.description}
                onChange={(e) => updateItem(i, { description: e.target.value })}
                placeholder="Description (optional)"
                className="text-xs"
                disabled={locked}
              />

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                <Field label="Qty">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={item.quantity}
                    onChange={(e) => updateItem(i, { quantity: e.target.value })}
                  />
                </Field>
                <Field label="Unit">
                  <Input value={item.unit} onChange={(e) => updateItem(i, { unit: e.target.value })} disabled={locked} />
                </Field>
                <Field label="Rate">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={item.rate}
                    onChange={(e) => updateItem(i, { rate: e.target.value })}
                  />
                </Field>
                <Field label="Disc %">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    value={item.discountPercent}
                    onChange={(e) => updateItem(i, { discountPercent: e.target.value })}
                    disabled={locked}
                  />
                </Field>
                <Field label="Tax %">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={item.taxPercent}
                    onChange={(e) => updateItem(i, { taxPercent: e.target.value })}
                    disabled={locked}
                  />
                </Field>
                <Field label="Line Total">
                  <div className="h-8 flex items-center px-2.5 rounded-lg bg-muted/50 text-sm font-medium tabular-nums text-foreground">
                    {c ? Number(c.lineTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
                  </div>
                </Field>
              </div>
            </div>
          );
        })}
      </div>

      {!locked && (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onChange([...items, emptyItem()])}>
          <Plus className="h-3.5 w-3.5" /> Add Item
        </Button>
      )}

      {!locked && invoiceFamily(type) === "SALES" && (
        <CatalogPickerDialog
          open={catalogOpen}
          onOpenChange={setCatalogOpen}
          onSelect={(row) => {
            onChange([
              ...items,
              {
                key: newItemKey(),
                catalogRowId: row.id,
                productName: row.productName,
                description: row.description ?? "",
                hsnSac: row.hsnCode ?? "",
                quantity: "1",
                unit: "pcs",
                rate: String(row.priceBeforeGst || row.priceAfterGst || 0),
                discountPercent: "0",
                taxPercent: String(row.gstPercent ?? 0),
              },
            ]);
          }}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
