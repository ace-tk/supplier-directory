"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, X, Loader2, Save, Send } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { validateImage } from "@/lib/file-validation";
import { FASHION_CATEGORIES } from "@/lib/shop-data";
import { saveWishDraftAction, submitWishAction } from "@/services/wishes";
import type { ProductWishRecord } from "@/types/wishes";

const formSchema = z.object({
  name: z.string().min(1, "Wish name is required"),
  category: z.string().optional(),
  description: z.string().optional(),
  targetQuantity: z.string().optional(),
  targetMoq: z.string().optional(),
  targetPrice: z.string().optional(),
  currency: z.string().default("INR"),
  material: z.string().optional(),
  colors: z.string().optional(),
  sizes: z.string().optional(),
  targetLocation: z.string().optional(),
  requiredBy: z.string().optional(),
  notes: z.string().optional(),
  referenceUrl: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function toFormValues(wish?: ProductWishRecord): FormValues {
  return {
    name: wish?.name ?? "",
    category: wish?.category ?? "",
    description: wish?.description ?? "",
    targetQuantity: wish?.targetQuantity?.toString() ?? "",
    targetMoq: wish?.targetMoq?.toString() ?? "",
    targetPrice: wish?.targetPrice?.toString() ?? "",
    currency: wish?.currency ?? "INR",
    material: wish?.material ?? "",
    colors: wish?.colors.join(", ") ?? "",
    sizes: wish?.sizes.join(", ") ?? "",
    targetLocation: wish?.targetLocation ?? "",
    requiredBy: wish?.requiredBy ? wish.requiredBy.slice(0, 10) : "",
    notes: wish?.notes ?? "",
    referenceUrl: wish?.referenceUrl ?? "",
  };
}

/** Create or edit a Wish draft. Submitted wishes are read-only for the
 * buyer (services/wishes.ts refuses the update server-side too), so this
 * component is never rendered for a non-DRAFT wish — the [id]/edit page
 * redirects to the read-only detail view instead. */
export function WishForm({ wish }: { wish?: ProductWishRecord }) {
  const router = useRouter();
  const [images, setImages] = useState<{ id: string; dataUrl: string }[]>(
    wish?.images.map((i) => ({ id: i.id, dataUrl: i.dataUrl })) ?? []
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- zodResolver type diverges from RHF Resolver generic
    resolver: zodResolver(formSchema) as any,
    defaultValues: toFormValues(wish),
  });

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    if (images.length + files.length > 6) {
      toast.error("You can upload up to 6 images.");
      return;
    }
    setUploading(true);
    try {
      for (const file of files) {
        const validation = validateImage(file.type, file.size);
        if (!validation.valid) {
          toast.error(validation.error);
          continue;
        }
        const dataUrl = await fileToDataUrl(file);
        setImages((prev) => [...prev, { id: crypto.randomUUID(), dataUrl }]);
      }
    } finally {
      setUploading(false);
    }
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }

  function buildPayload(values: FormValues) {
    return {
      id: wish?.id,
      name: values.name,
      category: values.category || "",
      description: values.description || "",
      images: images.map((img) => ({ dataUrl: img.dataUrl })),
      targetQuantity: values.targetQuantity ? Number(values.targetQuantity) : undefined,
      targetMoq: values.targetMoq ? Number(values.targetMoq) : undefined,
      targetPrice: values.targetPrice ? Number(values.targetPrice) : undefined,
      currency: values.currency || "INR",
      material: values.material || undefined,
      colors: values.colors ? values.colors.split(",").map((s) => s.trim()).filter(Boolean) : [],
      sizes: values.sizes ? values.sizes.split(",").map((s) => s.trim()).filter(Boolean) : [],
      targetLocation: values.targetLocation || undefined,
      requiredBy: values.requiredBy || undefined,
      notes: values.notes || undefined,
      referenceUrl: values.referenceUrl || undefined,
    };
  }

  async function handleSaveDraft(values: FormValues) {
    setSaving(true);
    try {
      const result = await saveWishDraftAction(buildPayload(values));
      if (!result.success) return toast.error(result.error);
      toast.success("Draft saved");
      if (!wish) router.push(`/buyer/wishes/${result.data.id}/edit`);
      else router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitWish(values: FormValues) {
    setSubmitting(true);
    try {
      const saveResult = await saveWishDraftAction(buildPayload(values));
      if (!saveResult.success) return toast.error(saveResult.error);

      const submitResult = await submitWishAction(saveResult.data.id);
      if (!submitResult.success) return toast.error(submitResult.error);

      toast.success("Wish submitted");
      router.push("/buyer/wishes");
    } finally {
      setSubmitting(false);
    }
  }

  const busy = saving || submitting;

  return (
    <div>
      <PageHeader
        title={wish ? "Edit Your Wish" : "Add Your Wish"}
        description="Tell us what product you're looking for. Add a reference image and details, and we'll help turn the idea into a sourcing/manufacturing request."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-1.5" disabled={busy} onClick={handleSubmit(handleSaveDraft)}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Draft
            </Button>
            <Button className="gap-1.5" disabled={busy} onClick={handleSubmit(handleSubmitWish)}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Submit Wish
            </Button>
          </div>
        }
      />

      <div className="max-w-3xl space-y-6">
        <div className="space-y-1.5">
          <Label>Product / Wish Name *</Label>
          <Input {...register("name")} placeholder="e.g. Custom Linen Shirt" aria-invalid={!!errors.name} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Category *</Label>
            <Select value={watch("category")} onValueChange={(v) => v && setValue("category", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {FASHION_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reference URL</Label>
            <Input {...register("referenceUrl")} placeholder="https://..." />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Description *</Label>
          <Textarea rows={4} {...register("description")} placeholder="Describe the product you're looking for — fabric, style, use case, anything that helps us understand the idea." />
        </div>

        <div className="space-y-3">
          <Label>Reference Images *</Label>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading}
              className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span className="text-[10px]">Add</span>
            </button>
            <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />

            {images.map((img) => (
              <div key={img.id} className="relative group aspect-square rounded-xl overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.dataUrl} alt="Reference" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">JPG, PNG, WEBP, or GIF — up to 5MB each, 6 images max.</p>
        </div>

        <div className="border-t border-border pt-6 space-y-4">
          <p className="text-sm font-medium text-foreground">Optional details</p>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Target Quantity</Label>
              <Input type="number" min={1} {...register("targetQuantity")} placeholder="e.g. 500" />
            </div>
            <div className="space-y-1.5">
              <Label>Target MOQ</Label>
              <Input type="number" min={1} {...register("targetMoq")} placeholder="e.g. 100" />
            </div>
            <div className="space-y-1.5">
              <Label>Required By</Label>
              <Input type="date" {...register("requiredBy")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Target Price / Budget</Label>
              <div className="flex gap-2">
                <Select value={watch("currency")} onValueChange={(v) => v && setValue("currency", v)}>
                  <SelectTrigger className="w-24 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" min={0} {...register("targetPrice")} placeholder="e.g. 1200" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Preferred Material</Label>
              <Input {...register("material")} placeholder="e.g. Linen" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Colors</Label>
              <Input {...register("colors")} placeholder="Black, Navy, Olive (comma separated)" />
            </div>
            <div className="space-y-1.5">
              <Label>Sizes</Label>
              <Input {...register("sizes")} placeholder="S, M, L, XL (comma separated)" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Target Location</Label>
            <Input {...register("targetLocation")} placeholder="e.g. Mumbai, India" />
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={3} {...register("notes")} placeholder="Anything else worth mentioning..." />
          </div>
        </div>
      </div>
    </div>
  );
}
