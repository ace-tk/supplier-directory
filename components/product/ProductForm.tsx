"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Send, Wand2, Package, Layers, Award, Palette, Hash, FileText, Boxes, Percent, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VoiceNotesField } from "@/components/articles/VoiceNotesField";
import { TextCombobox } from "./TextCombobox";
import { VariantsSection } from "./VariantsSection";
import { ProductVisualWorkspace, type PendingImage, type ProductMetadataItem } from "./ProductVisualWorkspace";
import { ProductLocationSection, type ProductLocationValue } from "./ProductLocationSection";
import { ProductDescriptionGenerator } from "./ProductDescriptionGenerator";
import { GST_RATE_OPTIONS, computeCatalogPriceAfterGst, generateProductSku } from "@/lib/catalog-ui";
import { getCatalogAction, addRowAction, updateRowAction, addRowImageAction } from "@/services/catalog";
import { listWarehousesAction, listRetailStoresAction, type LocationOption } from "@/services/locations";
import type { CatalogRowRecord, CatalogRowImageEntry, CatalogRowStatus } from "@/types/catalog";
import type { CatalogRowInput } from "@/lib/validations/catalog";

interface FormState {
  productName: string;
  category: string;
  brandName: string;
  color: string;
  sku: string;
  description: string;
  hsnCode: string;
  sizes: string[];
  gender: string;
  quantity: string;
  priceBeforeGst: string;
  gstPercent: number;
  location: ProductLocationValue;
}

function formFromRow(row: CatalogRowRecord | null): FormState {
  return {
    productName: row?.productName ?? "",
    category: row?.category ?? "",
    brandName: row?.brandName ?? "",
    color: row?.color ?? "",
    sku: row?.sku ?? "",
    description: row?.description ?? "",
    hsnCode: row?.hsnCode ?? "",
    sizes: row?.sizes ?? [],
    gender: row?.gender ?? "",
    quantity: String(row?.quantity ?? 0),
    priceBeforeGst: String(row?.priceBeforeGst ?? 0),
    gstPercent: row?.gstPercent ?? 0,
    location: {
      locationType: row?.locationType ?? null,
      warehouseId: row?.warehouseId ?? null,
      retailStoreId: row?.retailStoreId ?? null,
    },
  };
}

/** Small compact field wrapper — icon + label above a dense h-8 input, the
 * "boxed-field" density this redesign uses throughout General Information
 * instead of the old full-height stretched inputs. */
function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
        <Icon className="h-3 w-3" /> {label}
      </Label>
      {children}
    </div>
  );
}

const inputClass = "h-8 text-sm";

/**
 * A dedicated, polished view over the SAME CatalogRow/Catalog records
 * Catalog Management already owns — reuses addRowAction/updateRowAction/
 * addRowImageAction etc. verbatim, so a Product created or edited here is
 * the exact same row Catalog Management (and the invoice catalog picker)
 * sees, never a parallel copy.
 *
 * Layout: a two-column "product studio" — General Information + Variants
 * on the left, a large Product Visual Workspace (images, view tabs, real
 * metadata) on the right — replacing the previous single stacked form.
 */
export function ProductForm({ basePath, initialRow }: { basePath: string; initialRow: CatalogRowRecord | null }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => formFromRow(initialRow));
  const [images, setImages] = useState<CatalogRowImageEntry[]>(initialRow?.images ?? []);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [existingSkus, setExistingSkus] = useState<string[]>([]);
  const [warehouses, setWarehouses] = useState<LocationOption[]>([]);
  const [retailStores, setRetailStores] = useState<LocationOption[]>([]);

  useEffect(() => {
    getCatalogAction().then((r) => {
      if (!r.success) return;
      setExistingCategories([...new Set(r.data.rows.map((row) => row.category).filter((c): c is string => !!c))]);
      setExistingSkus(r.data.rows.map((row) => row.sku).filter((s): s is string => !!s));
    });
    listWarehousesAction().then((r) => r.success && setWarehouses(r.data));
    listRetailStoresAction().then((r) => r.success && setRetailStores(r.data));
  }, []);

  function patch(p: Partial<FormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  const priceAfterGst = computeCatalogPriceAfterGst(Number(form.priceBeforeGst) || 0, form.gstPercent);
  const canSaveAsDraft = !initialRow || initialRow.status === "DRAFT";

  function handleGenerateSku() {
    const sku = generateProductSku({ brandName: form.brandName, category: form.category, productName: form.productName }, existingSkus);
    patch({ sku });
  }

  const locationLabel =
    form.location.locationType === "WAREHOUSE"
      ? (warehouses.find((w) => w.id === form.location.warehouseId)?.name ?? null)
      : form.location.locationType === "RETAIL_STORE"
        ? (retailStores.find((s) => s.id === form.location.retailStoreId)?.name ?? null)
        : null;

  const metadata: ProductMetadataItem[] = useMemo(
    () =>
      [
        form.category && { label: "Category", value: form.category },
        form.productName && { label: "Product Name", value: form.productName },
        form.brandName && { label: "Brand", value: form.brandName },
        form.color && { label: "Color", value: form.color },
        form.sizes.length > 0 && { label: "Sizes", value: form.sizes.join(", ") },
        form.gender && { label: "Gender", value: form.gender },
        locationLabel && { label: form.location.locationType === "WAREHOUSE" ? "Warehouse" : "Retail Store", value: locationLabel },
        { label: "GST", value: `${form.gstPercent}%` },
        { label: "Stock", value: form.quantity || "0" },
      ].filter((x): x is ProductMetadataItem => Boolean(x)),
    [form, locationLabel]
  );

  async function handleSave(targetStatus: "DRAFT" | "ACTIVE") {
    if (!form.productName.trim()) {
      toast.error("Product name is required.");
      return;
    }
    setSaving(targetStatus === "DRAFT" ? "draft" : "publish");
    const resolvedStatus: CatalogRowStatus =
      initialRow && initialRow.status !== "DRAFT" ? initialRow.status : targetStatus;

    const input: Partial<CatalogRowInput> = {
      productName: form.productName.trim() || "Untitled Product",
      category: form.category.trim() || undefined,
      brandName: form.brandName.trim() || undefined,
      color: form.color.trim() || undefined,
      sku: form.sku.trim() || undefined,
      description: form.description.trim() || undefined,
      hsnCode: form.hsnCode.trim() || undefined,
      sizes: form.sizes,
      gender: form.gender || undefined,
      quantity: Number(form.quantity) || 0,
      priceBeforeGst: Number(form.priceBeforeGst) || 0,
      gstPercent: form.gstPercent,
      locationType: form.location.locationType,
      warehouseId: form.location.warehouseId,
      retailStoreId: form.location.retailStoreId,
      status: resolvedStatus,
    };

    if (initialRow) {
      const result = await updateRowAction(initialRow.id, input);
      setSaving(null);
      if (!result.success) return toast.error(result.error);
      toast.success("Product updated");
      router.push(basePath);
      router.refresh();
      return;
    }

    const result = await addRowAction(input);
    if (!result.success) {
      setSaving(null);
      return toast.error(result.error);
    }
    for (const img of pendingImages) {
      await addRowImageAction(result.data.id, img);
    }
    setSaving(null);
    toast.success(targetStatus === "DRAFT" ? "Draft saved" : "Product added");
    router.push(basePath);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={initialRow ? "Edit Product" : "Add Product"}
        breadcrumbs={[{ label: "Product", href: basePath }, { label: initialRow ? "Edit" : "Add" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push(basePath)}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            {canSaveAsDraft && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={saving !== null}
                onClick={() => handleSave("DRAFT")}
              >
                {saving === "draft" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Draft
              </Button>
            )}
            <Button size="sm" className="gap-1.5" disabled={saving !== null} onClick={() => handleSave("ACTIVE")}>
              {saving === "publish" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {initialRow ? "Save Changes" : "Add Product"}
            </Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-[11fr_9fr] gap-6 items-start">
        {/* Left / General Information + Variants */}
        <div className="space-y-6 min-w-0">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">General Information</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add basic details, pricing, inventory and tax information for this product.
              </p>
            </div>

            <Field label="Product Name" icon={Package}>
              <Input className={inputClass} value={form.productName} onChange={(e) => patch({ productName: e.target.value })} />
            </Field>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Category" icon={Layers}>
                <TextCombobox
                  value={form.category}
                  onChange={(v) => patch({ category: v })}
                  options={existingCategories}
                  placeholder="Select or add"
                  addLabel="Add Category"
                />
              </Field>
              <Field label="Brand Name" icon={Award}>
                <Input className={inputClass} value={form.brandName} onChange={(e) => patch({ brandName: e.target.value })} placeholder="Optional" />
              </Field>
              <Field label="Color" icon={Palette}>
                <Input className={inputClass} value={form.color} onChange={(e) => patch({ color: e.target.value })} placeholder="Optional" />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="SKU" icon={Hash}>
                <div className="flex gap-1.5">
                  <Input className={`${inputClass} flex-1`} value={form.sku} onChange={(e) => patch({ sku: e.target.value })} placeholder="Optional" />
                  <Button type="button" variant="outline" size="sm" className="h-8 gap-1 shrink-0 px-2" onClick={handleGenerateSku} title="Generate SKU">
                    <Wand2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Field>
              <Field label="HSN Code" icon={FileText}>
                <Input className={inputClass} value={form.hsnCode} onChange={(e) => patch({ hsnCode: e.target.value })} placeholder="Optional" />
              </Field>
            </div>

            <div className="space-y-1.5">
              <VoiceNotesField
                label="Product Description"
                value={form.description}
                onChange={(v) => patch({ description: v })}
                rows={3}
                placeholder="Optional"
              />
              <div className="flex justify-end">
                <ProductDescriptionGenerator
                  fields={{
                    productName: form.productName,
                    category: form.category || undefined,
                    brandName: form.brandName || undefined,
                    color: form.color || undefined,
                    sizes: form.sizes,
                    gender: form.gender || undefined,
                    quantity: Number(form.quantity) || undefined,
                    gstPercent: form.gstPercent,
                    priceBeforeGst: Number(form.priceBeforeGst) || undefined,
                    currency: "INR",
                    existingDescription: form.description || undefined,
                  }}
                  onApply={(text) => patch({ description: text })}
                />
              </div>
            </div>

            <Field label="Stock / Quantity" icon={Boxes}>
              <Input
                type="number"
                min={0}
                className={`${inputClass} max-w-[160px]`}
                value={form.quantity}
                onChange={(e) => patch({ quantity: e.target.value })}
              />
            </Field>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
              <Field label="Price Before GST" icon={Wallet}>
                <Input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.priceBeforeGst}
                  onChange={(e) => patch({ priceBeforeGst: e.target.value })}
                />
              </Field>
              <Field label="GST %" icon={Percent}>
                <Select value={String(form.gstPercent)} onValueChange={(v) => v && patch({ gstPercent: Number(v) })}>
                  <SelectTrigger className="w-full h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GST_RATE_OPTIONS.map((r) => (
                      <SelectItem key={r} value={String(r)}>
                        {r}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Final Price" icon={Wallet}>
                <div className="h-8 flex items-center px-2.5 rounded-lg bg-muted/50 text-sm font-semibold tabular-nums text-foreground">
                  {priceAfterGst.toFixed(2)}
                </div>
              </Field>
            </div>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {(Number(form.priceBeforeGst) || 0).toFixed(2)} + {form.gstPercent}% GST = {priceAfterGst.toFixed(2)}
            </p>
          </div>

          <ProductLocationSection value={form.location} onChange={(location) => patch({ location })} />

          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Variants</h2>
            <VariantsSection
              sizes={form.sizes}
              onSizesChange={(sizes) => patch({ sizes })}
              gender={form.gender}
              onGenderChange={(gender) => patch({ gender })}
            />
          </div>
        </div>

        {/* Right / Product Visual Workspace */}
        <div className="space-y-6 min-w-0">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-foreground">Product Visual</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Upload and organize this product&apos;s images.</p>
            </div>
            <ProductVisualWorkspace
              rowId={initialRow?.id ?? null}
              images={images}
              onImagesChange={setImages}
              pendingImages={pendingImages}
              onPendingImagesChange={setPendingImages}
              metadata={metadata}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
