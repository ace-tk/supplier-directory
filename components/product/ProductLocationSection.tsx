"use client";

import { useEffect, useState } from "react";
import { Warehouse as WarehouseIcon, Store } from "lucide-react";
import { Label } from "@/components/ui/label";
import { LocationCombobox } from "./LocationCombobox";
import { listWarehousesAction, listRetailStoresAction, createWarehouseAction, createRetailStoreAction, type LocationOption } from "@/services/locations";
import { cn } from "@/lib/utils";
import type { ProductLocationType } from "@/types/catalog";

export interface ProductLocationValue {
  locationType: ProductLocationType | null;
  warehouseId: string | null;
  retailStoreId: string | null;
}

/**
 * The Product module's real, persisted Warehouse-vs-Retail-Store
 * assignment — a segmented type choice plus a single conditional selector
 * over real Warehouse/RetailStore records (created inline via
 * LocationCombobox's "Add ..." action, never hardcoded names). Selecting a
 * type never leaves the other type's selection lingering — switching
 * always clears it in the same onChange call, mirrored server-side by
 * normalizeLocationFields in services/catalog.ts.
 */
export function ProductLocationSection({ value, onChange }: { value: ProductLocationValue; onChange: (v: ProductLocationValue) => void }) {
  const [warehouses, setWarehouses] = useState<LocationOption[]>([]);
  const [retailStores, setRetailStores] = useState<LocationOption[]>([]);

  useEffect(() => {
    listWarehousesAction().then((r) => r.success && setWarehouses(r.data));
    listRetailStoresAction().then((r) => r.success && setRetailStores(r.data));
  }, []);

  function selectType(type: ProductLocationType) {
    if (type === value.locationType) return;
    onChange({
      locationType: type,
      warehouseId: type === "WAREHOUSE" ? value.warehouseId : null,
      retailStoreId: type === "RETAIL_STORE" ? value.retailStoreId : null,
    });
  }

  async function handleCreateWarehouse(name: string) {
    const result = await createWarehouseAction(name);
    if (result.success) {
      setWarehouses((prev) => [...prev.filter((w) => w.id !== result.data.id), result.data].sort((a, b) => a.name.localeCompare(b.name)));
      onChange({ ...value, warehouseId: result.data.id });
    }
    return result;
  }

  async function handleCreateRetailStore(name: string) {
    const result = await createRetailStoreAction(name);
    if (result.success) {
      setRetailStores((prev) => [...prev.filter((s) => s.id !== result.data.id), result.data].sort((a, b) => a.name.localeCompare(b.name)));
      onChange({ ...value, retailStoreId: result.data.id });
    }
    return result;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Product Location Type</h2>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => selectType("WAREHOUSE")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
            value.locationType === "WAREHOUSE"
              ? "border-primary bg-primary/5 text-primary"
              : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
          )}
        >
          <WarehouseIcon className="h-4 w-4" /> Warehouse
        </button>
        <button
          type="button"
          onClick={() => selectType("RETAIL_STORE")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
            value.locationType === "RETAIL_STORE"
              ? "border-primary bg-primary/5 text-primary"
              : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
          )}
        >
          <Store className="h-4 w-4" /> Retail Store
        </button>
      </div>

      {value.locationType === "WAREHOUSE" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Warehouse</Label>
          <LocationCombobox
            value={value.warehouseId}
            options={warehouses}
            onSelect={(id) => onChange({ ...value, warehouseId: id })}
            onCreate={handleCreateWarehouse}
            placeholder="Select warehouse"
            addLabel="Add Warehouse"
          />
        </div>
      )}

      {value.locationType === "RETAIL_STORE" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Retail Store</Label>
          <LocationCombobox
            value={value.retailStoreId}
            options={retailStores}
            onSelect={(id) => onChange({ ...value, retailStoreId: id })}
            onCreate={handleCreateRetailStore}
            placeholder="Select retail store"
            addLabel="Add Retail Store"
          />
        </div>
      )}

      {!value.locationType && (
        <p className="text-[11px] text-muted-foreground">Optional — assign this product to a warehouse or retail store.</p>
      )}
    </div>
  );
}
