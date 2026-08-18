"use client";

import { useState, type ComponentType } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Loader2,
  Send,
  CheckCircle2,
  Package,
  Clock,
  MapPin,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Product } from "@/types/product";
import { submitCounterOffer } from "@/lib/product-requests";

const counterOfferSchema = z.object({
  offerPrice: z.string().min(1, "Enter your offer price"),
  quantity: z.string().min(1, "Enter required quantity"),
  expectedDelivery: z.string().min(1, "Select an expected delivery date"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof counterOfferSchema>;
type Step = "terms" | "offer" | "done";

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-border/40 last:border-0">
      <span className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
        <Icon className="w-3.5 h-3.5" /> {label}
      </span>
      <span className="text-xs font-medium text-foreground text-right">{value}</span>
    </div>
  );
}

export function CounterOfferModal({
  product,
  open,
  onOpenChange,
  initialStep = "terms",
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "terms" = View Offer entry point, "offer" = Counter Offer entry point
   * — same modal/state/API either way, just a different starting step. */
  initialStep?: "terms" | "offer";
}) {
  const [step, setStep] = useState<Step>(initialStep);
  const supplier = product?.supplier;

  // Adjusted during render (not in an effect) so reopening with a
  // different initialStep (e.g. "View Offer" then later "Counter Offer")
  // always lands on the right step, even though the modal stays mounted
  // between opens.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setStep(initialStep);
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- zodResolver type diverges from RHF Resolver generic
    resolver: zodResolver(counterOfferSchema) as any,
  });

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setTimeout(() => {
        setStep("terms");
        reset();
      }, 200);
    }
  }

  async function onSubmit(values: FormValues) {
    if (!product) return;
    await submitCounterOffer({
      productId: product.id,
      productName: product.name,
      supplierId: supplier?.id ?? "",
      supplierName: supplier?.companyName ?? "",
      ...values,
    });
    setStep("done");
    toast.success("Your counter offer has been sent to the supplier.");
  }

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === "done" ? (
          <div className="flex flex-col items-center text-center py-6 gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Offer sent</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your counter offer has been sent to the supplier.
              </p>
            </div>
            <Button onClick={() => handleOpenChange(false)} className="mt-2">
              Done
            </Button>
          </div>
        ) : step === "terms" ? (
          <>
            <DialogHeader>
              <DialogTitle>Deal Terms</DialogTitle>
              <DialogDescription className="truncate">{product.name}</DialogDescription>
            </DialogHeader>

            <div>
              <DetailRow icon={Package} label="Current MOQ" value={product.moq ?? "N/A"} />
              <DetailRow icon={Wallet} label="Price Range" value={product.priceRange ?? "N/A"} />
              <DetailRow
                icon={Wallet}
                label="Minimum Order Value"
                value={supplier?.minimumOrder ?? "N/A"}
              />
              <DetailRow icon={Clock} label="Lead Time" value={product.leadTime ?? "N/A"} />
              <DetailRow
                icon={MapPin}
                label="Delivery Location"
                value={supplier ? `${supplier.city}, ${supplier.country}` : "N/A"}
              />
            </div>

            <Button onClick={() => setStep("offer")} className="w-full gap-2">
              Make Counter Offer
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep("terms")}
                  className="p-1 -ml-1 rounded-lg hover:bg-muted transition-colors"
                  aria-label="Back to deal terms"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <DialogTitle>Make Counter Offer</DialogTitle>
              </div>
              <DialogDescription className="truncate">{product.name}</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="offerPrice" className="text-xs">
                    Offer Price
                  </Label>
                  <Input
                    id="offerPrice"
                    placeholder="e.g. ₹280 per pc"
                    aria-invalid={!!errors.offerPrice}
                    {...register("offerPrice")}
                  />
                  {errors.offerPrice && (
                    <p className="text-xs text-destructive">{errors.offerPrice.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="quantity" className="text-xs">
                    Required Quantity
                  </Label>
                  <Input
                    id="quantity"
                    placeholder="e.g. 500 pcs"
                    aria-invalid={!!errors.quantity}
                    {...register("quantity")}
                  />
                  {errors.quantity && (
                    <p className="text-xs text-destructive">{errors.quantity.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="expectedDelivery" className="text-xs">
                  Expected Delivery
                </Label>
                <Input
                  id="expectedDelivery"
                  type="date"
                  aria-invalid={!!errors.expectedDelivery}
                  {...register("expectedDelivery")}
                />
                {errors.expectedDelivery && (
                  <p className="text-xs text-destructive">{errors.expectedDelivery.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="notes" className="text-xs">
                  Notes <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="notes"
                  rows={3}
                  placeholder="Additional requirements or negotiation notes..."
                  {...register("notes")}
                />
              </div>

              <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Submit Counter Offer
                  </>
                )}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
