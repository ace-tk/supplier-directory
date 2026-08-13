"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Send } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TextCombobox } from "./TextCombobox";
import { VariantsSection } from "./VariantsSection";
import { ProductImageUploader, type PendingImage } from "./ProductImageUploader";
import { ProductLocationSection, type ProductLocationValue } from "./ProductLocationSection";
import { GST_RATE_OPTIONS, computeCatalogPriceAfterGst } from "@/lib/catalog-ui";
import { getCatalogAction, addRowAction, updateRowAction, addRowImageAction } from "@/services/catalog";
import type { CatalogRowRecord, CatalogRowImageEntry, CatalogRowStatus } from "@/types/catalog";
import type { CatalogRowInput } from "@/lib/validations/catalog";

interface FormState {
  productName: string;
  category: string;
  brandName: string;
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

/**
 * A dedicated, polished view over the SAME CatalogRow/Catalog records
 * Catalog Management already owns — reuses addRowAction/updateRowAction/
 * addRowImageAction etc. verbatim, so a Product created or edited here is
 * the exact same row Catalog Management (and the invoice catalog picker)
 * sees, never a parallel copy.
 */
export function ProductForm({ basePath, initialRow }: { basePath: string; initialRow: CatalogRowRecord | null }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => formFromRow(initialRow));
  const [images, setImages] = useState<CatalogRowImageEntry[]>(initialRow?.images ?? []);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);

  useEffect(() => {
    getCatalogAction().then((r) => {
      if (!r.success) return;
      setExistingCategories([...new Set(r.data.rows.map((row) => row.category).filter((c): c is string => !!c))]);
    });
  }, []);

  function patch(p: Partial<FormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  const priceAfterGst = computeCatalogPriceAfterGst(Number(form.priceBeforeGst) || 0, form.gstPercent);
  const canSaveAsDraft = !initialRow || initialRow.status === "DRAFT";

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

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        {/* Left / main area */}
        <div className="space-y-6 min-w-0">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">General Information</h2>
            <div className="space-y-1.5">
              <Label className="text-xs">Product Name</Label>
              <Input value={form.productName} onChange={(e) => patch({ productName: e.target.value })} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Brand Name</Label>
                <Input value={form.brandName} onChange={(e) => patch({ brandName: e.target.value })} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">SKU</Label>
                <Input value={form.sku} onChange={(e) => patch({ sku: e.target.value })} placeholder="Optional" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Product Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => patch({ description: e.target.value })} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">HSN Code</Label>
              <Input value={form.hsnCode} onChange={(e) => patch({ hsnCode: e.target.value })} placeholder="Optional" className="max-w-xs" />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Variants</h2>
            <VariantsSection
              sizes={form.sizes}
              onSizesChange={(sizes) => patch({ sizes })}
              gender={form.gender}
              onGenderChange={(gender) => patch({ gender })}
            />
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Pricing & Stock</h2>
            <div className="space-y-1.5 max-w-[160px]">
              <Label className="text-xs">Quantity / Stock</Label>
              <Input type="number" min={0} value={form.quantity} onChange={(e) => patch({ quantity: e.target.value })} />
            </div>
            <div className="grid sm:grid-cols-3 gap-4 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Price Before GST</Label>
                <Input type="number" min={0} value={form.priceBeforeGst} onChange={(e) => patch({ priceBeforeGst: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">GST %</Label>
                <Select value={String(form.gstPercent)} onValueChange={(v) => v && patch({ gstPercent: Number(v) })}>
                  <SelectTrigger className="w-full">
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
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Final Price</Label>
                <div className="h-8 flex items-center px-2.5 rounded-lg bg-muted/50 text-sm font-semibold tabular-nums text-foreground">
                  {priceAfterGst.toFixed(2)}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {(Number(form.priceBeforeGst) || 0).toFixed(2)} + {form.gstPercent}% GST = {priceAfterGst.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Right area */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Upload Images</h2>
            <ProductImageUploader
              rowId={initialRow?.id ?? null}
              images={images}
              onImagesChange={setImages}
              pendingImages={pendingImages}
              onPendingImagesChange={setPendingImages}
            />
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Category</h2>
            <TextCombobox
              value={form.category}
              onChange={(v) => patch({ category: v })}
              options={existingCategories}
              placeholder="Select or add a category"
              addLabel="Add Category"
            />
          </div>

          <ProductLocationSection value={form.location} onChange={(location) => patch({ location })} />
        </div>
      </div>
    </div>
  );
}
