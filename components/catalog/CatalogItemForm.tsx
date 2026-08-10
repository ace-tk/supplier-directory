"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { validateImage } from "@/lib/file-validation";
import { GST_RATE_OPTIONS, computeCatalogPriceAfterGst } from "@/lib/catalog-ui";
import { addRowAction, updateRowAction, addRowImageAction, removeRowImageAction } from "@/services/catalog";
import type { CatalogRowRecord, CatalogRowImageEntry, CatalogRowStatus } from "@/types/catalog";
import type { CatalogRowInput } from "@/lib/validations/catalog";

const STATUS_OPTIONS: { value: CatalogRowStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "DRAFT", label: "Draft" },
];
const CURRENCY_OPTIONS = ["INR", "USD", "EUR", "GBP"];

interface FormState {
  category: string;
  productName: string;
  brandName: string;
  sku: string;
  description: string;
  quantity: string;
  sizes: string;
  color: string;
  moq: string;
  hsnCode: string;
  gstPercent: number;
  priceBeforeGst: string;
  currency: string;
  shippingCost: string;
  miscCost: string;
  leadTime: string;
  status: CatalogRowStatus;
  notes: string;
}

function formFromRow(row: CatalogRowRecord | null): FormState {
  return {
    category: row?.category ?? "",
    productName: row?.productName ?? "",
    brandName: row?.brandName ?? "",
    sku: row?.sku ?? "",
    description: row?.description ?? "",
    quantity: String(row?.quantity ?? 0),
    sizes: row?.sizes.join(", ") ?? "",
    color: row?.color ?? "",
    moq: row?.moq != null ? String(row.moq) : "",
    hsnCode: row?.hsnCode ?? "",
    gstPercent: row?.gstPercent ?? 0,
    priceBeforeGst: String(row?.priceBeforeGst ?? 0),
    currency: row?.currency ?? "INR",
    shippingCost: String(row?.shippingCost ?? 0),
    miscCost: String(row?.miscCost ?? 0),
    leadTime: row?.leadTime ?? "",
    status: row?.status ?? "ACTIVE",
    notes: row?.notes ?? "",
  };
}

function formToInput(f: FormState): Partial<CatalogRowInput> {
  return {
    category: f.category.trim() || undefined,
    productName: f.productName.trim() || "Untitled Product",
    brandName: f.brandName.trim() || undefined,
    sku: f.sku.trim() || undefined,
    description: f.description.trim() || undefined,
    quantity: Number(f.quantity) || 0,
    sizes: f.sizes.split(",").map((s) => s.trim()).filter(Boolean),
    color: f.color.trim() || undefined,
    moq: f.moq ? Number(f.moq) : undefined,
    hsnCode: f.hsnCode.trim() || undefined,
    gstPercent: f.gstPercent,
    priceBeforeGst: Number(f.priceBeforeGst) || 0,
    currency: f.currency,
    shippingCost: Number(f.shippingCost) || 0,
    miscCost: Number(f.miscCost) || 0,
    leadTime: f.leadTime.trim() || undefined,
    status: f.status,
    notes: f.notes.trim() || undefined,
  };
}

export function CatalogItemForm({ basePath, initialRow }: { basePath: string; initialRow: CatalogRowRecord | null }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => formFromRow(initialRow));
  const [images, setImages] = useState<CatalogRowImageEntry[]>(initialRow?.images ?? []);
  const [pendingImages, setPendingImages] = useState<{ dataUrl: string; mimeType: string; sizeBytes: number }[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  function patch(p: Partial<FormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  const priceAfterGst = computeCatalogPriceAfterGst(Number(form.priceBeforeGst) || 0, form.gstPercent);

  async function handleImageAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const v = validateImage(file.type, file.size);
    if (!v.valid) return toast.error(v.error);

    setUploadingImage(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      if (initialRow) {
        const result = await addRowImageAction(initialRow.id, { dataUrl, mimeType: file.type, sizeBytes: file.size });
        if (!result.success) return toast.error(result.error);
        setImages((imgs) => [...imgs, result.data]);
      } else {
        setPendingImages((imgs) => [...imgs, { dataUrl, mimeType: file.type, sizeBytes: file.size }]);
      }
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleRemoveImage(id: string) {
    const result = await removeRowImageAction(id);
    if (!result.success) return toast.error(result.error);
    setImages((imgs) => imgs.filter((i) => i.id !== id));
  }

  function handleRemovePendingImage(index: number) {
    setPendingImages((imgs) => imgs.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!form.productName.trim()) {
      toast.error("Product name is required.");
      return;
    }
    setSaving(true);
    const input = formToInput(form);

    if (initialRow) {
      const result = await updateRowAction(initialRow.id, input);
      setSaving(false);
      if (!result.success) return toast.error(result.error);
      toast.success("Product updated");
      router.push(basePath);
      router.refresh();
      return;
    }

    const result = await addRowAction(input);
    if (!result.success) {
      setSaving(false);
      return toast.error(result.error);
    }
    for (const img of pendingImages) {
      await addRowImageAction(result.data.id, img);
    }
    setSaving(false);
    toast.success("Product added");
    router.push(basePath);
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={initialRow ? "Edit Product" : "Add Product"}
        breadcrumbs={[{ label: "Catalog Management", href: basePath }, { label: initialRow ? "Edit" : "Add" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push(basePath)}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <Button size="sm" className="gap-1.5" disabled={saving} onClick={handleSave}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {initialRow ? "Save Changes" : "Add Product"}
            </Button>
          </div>
        }
      />

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Product Details</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Product Name</Label>
            <Input value={form.productName} onChange={(e) => patch({ productName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Product Category</Label>
            <Input value={form.category} onChange={(e) => patch({ category: e.target.value })} />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Brand Name</Label>
            <Input value={form.brandName} onChange={(e) => patch({ brandName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">SKU</Label>
            <Input value={form.sku} onChange={(e) => patch({ sku: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Description</Label>
          <Textarea rows={2} value={form.description} onChange={(e) => patch({ description: e.target.value })} />
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Quantity</Label>
            <Input type="number" min={0} value={form.quantity} onChange={(e) => patch({ quantity: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">MOQ</Label>
            <Input type="number" min={0} value={form.moq} onChange={(e) => patch({ moq: e.target.value })} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Color</Label>
            <Input value={form.color} onChange={(e) => patch({ color: e.target.value })} placeholder="Optional" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Sizes</Label>
          <Input value={form.sizes} onChange={(e) => patch({ sizes: e.target.value })} placeholder="S, M, L (comma separated)" />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Pricing & Tax</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Price Before GST</Label>
            <Input type="number" min={0} value={form.priceBeforeGst} onChange={(e) => patch({ priceBeforeGst: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">GST / Tax %</Label>
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
            <Label className="text-xs">Price (after GST)</Label>
            <div className="h-8 flex items-center px-2.5 rounded-lg bg-muted/50 text-sm font-medium tabular-nums text-foreground">
              {priceAfterGst.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">HSN Code</Label>
            <Input value={form.hsnCode} onChange={(e) => patch({ hsnCode: e.target.value })} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Currency</Label>
            <Select value={form.currency} onValueChange={(v) => v && patch({ currency: v })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Shipping Cost</Label>
            <Input type="number" min={0} value={form.shippingCost} onChange={(e) => patch({ shippingCost: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Misc. Cost</Label>
            <Input type="number" min={0} value={form.miscCost} onChange={(e) => patch({ miscCost: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Fulfillment & Status</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Lead Time</Label>
            <Input value={form.leadTime} onChange={(e) => patch({ leadTime: e.target.value })} placeholder="e.g. 15 days" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={(v) => v && patch({ status: v as CatalogRowStatus })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Notes</Label>
          <Textarea rows={2} value={form.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="Optional" />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Images</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploadingImage}
            className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
          >
            {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </button>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageAdd} />

          {images.map((img) => (
            <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.dataUrl} alt="Product" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => handleRemoveImage(img.id)}
                className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {pendingImages.map((img, i) => (
            <div key={i} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.dataUrl} alt="Product" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => handleRemovePendingImage(i)}
                className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
