"use client";

import { useState } from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { Plus, Trash2, ChevronDown, X, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CreateProjectFormValues } from "@/lib/validations/project";

function currency(n: number) {
  return n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

function SizeChips({ index }: { index: number }) {
  const { watch, setValue } = useFormContext<CreateProjectFormValues>();
  const [draft, setDraft] = useState("");
  const sizes = watch(`items.${index}.sizes`) ?? [];

  function addSize() {
    const value = draft.trim();
    if (!value) return;
    if (!sizes.includes(value)) {
      setValue(`items.${index}.sizes`, [...sizes, value], { shouldValidate: true });
    }
    setDraft("");
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">Sizes</Label>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {sizes.map((s) => (
          <Badge key={s} variant="secondary" className="font-normal gap-1">
            {s}
            <button
              type="button"
              onClick={() => setValue(`items.${index}.sizes`, sizes.filter((x) => x !== s))}
              aria-label={`Remove size ${s}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          placeholder="e.g. S, M, L, XL"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addSize();
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={addSize}>
          Add
        </Button>
      </div>
    </div>
  );
}

function ItemCard({ index, onRemove }: { index: number; onRemove: () => void }) {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<CreateProjectFormValues>();
  const [open, setOpen] = useState(true);

  const name = watch(`items.${index}.name`);
  const category = watch(`items.${index}.category`);
  const quantity = Number(watch(`items.${index}.quantity`)) || 0;
  const priceAfterGst = Number(watch(`items.${index}.priceAfterGst`)) || 0;
  const itemErrors = errors.items?.[index];
  const subtotal = quantity * priceAfterGst;

  return (
    <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0">
            <Package className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{name || `Item ${index + 1}`}</p>
            <p className="text-[11px] text-muted-foreground truncate">{category || "No category"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-medium text-foreground tabular-nums">{currency(subtotal)}</span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Remove item"
          >
            <Trash2 className="h-4 w-4" />
          </span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/60 pt-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Product Category</Label>
              <Input placeholder="e.g. Apparel" aria-invalid={!!itemErrors?.category} {...register(`items.${index}.category`)} />
              {itemErrors?.category && <p className="text-xs text-destructive">{itemErrors.category.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Product Name</Label>
              <Input placeholder="e.g. Cotton Hoodie" aria-invalid={!!itemErrors?.name} {...register(`items.${index}.name`)} />
              {itemErrors?.name && <p className="text-xs text-destructive">{itemErrors.name.message}</p>}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Quantity</Label>
              <Input type="number" min={1} aria-invalid={!!itemErrors?.quantity} {...register(`items.${index}.quantity`)} />
              {itemErrors?.quantity && <p className="text-xs text-destructive">{itemErrors.quantity.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Lead Time</Label>
              <Input placeholder="e.g. 15 days" {...register(`items.${index}.leadTime`)} />
            </div>
          </div>

          <SizeChips index={index} />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Price Before GST</Label>
              <Input type="number" min={0} step="0.01" aria-invalid={!!itemErrors?.priceBeforeGst} {...register(`items.${index}.priceBeforeGst`)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Price After GST</Label>
              <Input type="number" min={0} step="0.01" aria-invalid={!!itemErrors?.priceAfterGst} {...register(`items.${index}.priceAfterGst`)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Shipping Cost</Label>
              <Input type="number" min={0} step="0.01" {...register(`items.${index}.shippingCost`)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Misc. Cost</Label>
              <Input type="number" min={0} step="0.01" {...register(`items.${index}.miscCost`)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ItemsSection() {
  const { control, watch } = useFormContext<CreateProjectFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = watch("items") ?? [];

  function addItem() {
    append({
      id: crypto.randomUUID(),
      category: "",
      name: "",
      quantity: 1,
      sizes: [],
      priceBeforeGst: 0,
      priceAfterGst: 0,
      shippingCost: 0,
      miscCost: 0,
      leadTime: "",
    });
  }

  const productTotal = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.priceAfterGst) || 0), 0);
  const shippingTotal = items.reduce((sum, it) => sum + (Number(it.shippingCost) || 0), 0);
  const miscTotal = items.reduce((sum, it) => sum + (Number(it.miscCost) || 0), 0);
  const grandTotal = productTotal + shippingTotal + miscTotal;

  return (
    <div className="space-y-4">
      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground">No items added yet. Add the products this project covers.</p>
      )}

      <div className="space-y-3">
        {fields.map((field, index) => (
          <ItemCard key={field.id} index={index} onRemove={() => remove(index)} />
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addItem}>
        <Plus className="h-3.5 w-3.5" /> Add Item
      </Button>

      {fields.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
          <p className="text-xs font-semibold text-foreground mb-1">Cost Summary</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-[11px] text-muted-foreground">Product Total</p>
              <p className="font-medium text-foreground tabular-nums">{currency(productTotal)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Shipping Total</p>
              <p className="font-medium text-foreground tabular-nums">{currency(shippingTotal)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Misc. Total</p>
              <p className="font-medium text-foreground tabular-nums">{currency(miscTotal)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Grand Total</p>
              <p className="font-semibold text-primary tabular-nums">{currency(grandTotal)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
