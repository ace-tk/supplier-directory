"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitCounterOffer } from "@/lib/product-requests";

const schema = z.object({
  offerPrice: z.string().min(1, "Enter your offer price"),
  quantity: z.string().min(1, "Enter required quantity"),
  expectedDelivery: z.string().min(1, "Select an expected delivery date"),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

/**
 * Counter Offer for a real Product Detail row — collects the same fields
 * and submits through the exact same submitCounterOffer service Shop's
 * CounterOfferModal already uses (lib/product-requests.ts). That service is
 * currently a mock (no persisted CounterOffer model exists anywhere in the
 * app yet), so this preserves its current — mock — behavior rather than
 * inventing a new, inconsistent backend just for Product Detail. Built as
 * its own lightweight dialog instead of reusing CounterOfferModal directly
 * because that component is tightly coupled to the Shop page's separate
 * mock Product/Supplier types, which don't apply to a real CatalogRow.
 */
export function CounterOfferDialog({
  open,
  onOpenChange,
  productId,
  productName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
}) {
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- zodResolver type diverges from RHF Resolver generic
    resolver: zodResolver(schema) as any,
    defaultValues: { offerPrice: "", quantity: "", expectedDelivery: "", notes: "" },
  });

  async function onSubmit(values: FormValues) {
    const result = await submitCounterOffer({
      productId,
      productName,
      supplierId: "",
      supplierName: "",
      offerPrice: values.offerPrice,
      quantity: values.quantity,
      expectedDelivery: values.expectedDelivery,
      notes: values.notes,
    });
    if (result.success) {
      setDone(true);
      toast.success("Counter offer submitted");
    }
  }

  function handleClose(next: boolean) {
    if (!next) {
      reset();
      setDone(false);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Counter Offer</DialogTitle>
          <DialogDescription>Propose your own price and terms for {productName}.</DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="text-sm font-medium text-foreground">Offer submitted</p>
            <p className="text-xs text-muted-foreground">The supplier will review your terms and respond.</p>
            <Button size="sm" onClick={() => handleClose(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="co-price" className="text-xs">Your Offer Price</Label>
                <Input id="co-price" placeholder="e.g. 850" aria-invalid={!!errors.offerPrice} {...register("offerPrice")} />
                {errors.offerPrice && <p className="text-xs text-destructive">{errors.offerPrice.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-qty" className="text-xs">Quantity</Label>
                <Input id="co-qty" placeholder="e.g. 500 pcs" aria-invalid={!!errors.quantity} {...register("quantity")} />
                {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="co-delivery" className="text-xs">Expected Delivery Date</Label>
              <Input id="co-delivery" type="date" aria-invalid={!!errors.expectedDelivery} {...register("expectedDelivery")} />
              {errors.expectedDelivery && <p className="text-xs text-destructive">{errors.expectedDelivery.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="co-notes" className="text-xs">Notes (optional)</Label>
              <Textarea id="co-notes" rows={3} placeholder="Any context for the supplier..." {...register("notes")} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-1.5">
                {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Submit Offer
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
