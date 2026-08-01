"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FASHION_CATEGORIES } from "@/lib/shop-data";
import { cn } from "@/lib/utils";

const addProductSchema = z.object({
  name: z.string().min(2, "Enter a product name"),
  category: z.string().min(1, "Select a category"),
  material: z.string().min(1, "Enter a material / fabric"),
  moq: z.string().min(1, "Enter a minimum order quantity"),
  priceMin: z.string().min(1, "Enter a minimum price"),
  priceMax: z.string().min(1, "Enter a maximum price"),
  leadTime: z.string().min(1, "Enter a lead time"),
  description: z.string().min(10, "Add a short description (10+ characters)"),
});

type FormValues = z.infer<typeof addProductSchema>;

// Mock submit — swap for a real `POST /api/supplier/products` call later;
// the form fields already mirror the Product model used by Shop.
async function submitProduct(_values: FormValues) {
  await new Promise((r) => setTimeout(r, 900));
}

export default function AddProductPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- zodResolver type diverges from RHF Resolver generic
    resolver: zodResolver(addProductSchema) as any,
  });

  function selectCategory(cat: string) {
    setSelectedCategory(cat);
    setValue("category", cat, { shouldValidate: true });
  }

  async function onSubmit(values: FormValues) {
    await submitProduct(values);
    toast.success(`"${values.name}" was added to your catalog`);
    router.push("/supplier/products");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Add Product" description="List a new product in your catalog." />

      <form onSubmit={handleSubmit(onSubmit)} className="rounded-2xl border border-border bg-card p-6 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-xs font-medium">Product name</Label>
          <Input id="name" placeholder="e.g. Embroidered Cotton Kurti" aria-invalid={!!errors.name} {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Category</Label>
          <div className="flex flex-wrap gap-1.5">
            {FASHION_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => selectCategory(cat)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-transparent hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
          <input type="hidden" {...register("category")} />
          {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="material" className="text-xs font-medium">Material / Fabric</Label>
          <Input id="material" placeholder="e.g. Cotton, Linen, Leather" aria-invalid={!!errors.material} {...register("material")} />
          {errors.material && <p className="text-xs text-destructive">{errors.material.message}</p>}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="moq" className="text-xs font-medium">MOQ</Label>
            <Input id="moq" placeholder="100 pcs" aria-invalid={!!errors.moq} {...register("moq")} />
            {errors.moq && <p className="text-xs text-destructive">{errors.moq.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="priceMin" className="text-xs font-medium">Min price (₹)</Label>
            <Input id="priceMin" placeholder="220" aria-invalid={!!errors.priceMin} {...register("priceMin")} />
            {errors.priceMin && <p className="text-xs text-destructive">{errors.priceMin.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="priceMax" className="text-xs font-medium">Max price (₹)</Label>
            <Input id="priceMax" placeholder="320" aria-invalid={!!errors.priceMax} {...register("priceMax")} />
            {errors.priceMax && <p className="text-xs text-destructive">{errors.priceMax.message}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="leadTime" className="text-xs font-medium">Lead time</Label>
          <Input id="leadTime" placeholder="14 Days" aria-invalid={!!errors.leadTime} {...register("leadTime")} />
          {errors.leadTime && <p className="text-xs text-destructive">{errors.leadTime.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-xs font-medium">Description</Label>
          <Textarea
            id="description"
            rows={4}
            placeholder="Describe the product, its quality, and what makes it stand out to buyers..."
            aria-invalid={!!errors.description}
            {...register("description")}
          />
          {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
        </div>

        <Button type="submit" className="gap-2" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add Product
        </Button>
      </form>
    </div>
  );
}
