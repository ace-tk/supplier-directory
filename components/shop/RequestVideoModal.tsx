"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
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
import { useSession } from "@/hooks/use-session";
import { submitVideoRequest } from "@/lib/product-requests";

const requestVideoSchema = z.object({
  buyerName: z.string().min(2, "Enter your name"),
  company: z.string().min(1, "Enter your company"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(6, "Enter a valid phone number"),
  message: z.string().optional(),
});

type FormValues = z.infer<typeof requestVideoSchema>;

export function RequestVideoModal({
  product,
  open,
  onOpenChange,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const session = useSession();
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- zodResolver type diverges from RHF Resolver generic
    resolver: zodResolver(requestVideoSchema) as any,
    defaultValues: { buyerName: "", company: "", email: "", phone: "", message: "" },
  });

  useEffect(() => {
    if (open && session) {
      reset({ buyerName: session.name, company: "", email: session.email, phone: "", message: "" });
    }
  }, [open, session, reset]);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setTimeout(() => setSubmitted(false), 200);
    }
  }

  async function onSubmit(values: FormValues) {
    if (!product) return;
    await submitVideoRequest({
      productId: product.id,
      productName: product.name,
      supplierId: product.supplier?.id ?? "",
      supplierName: product.supplier?.companyName ?? "",
      ...values,
    });
    setSubmitted(true);
    toast.success("Your request has been sent to the supplier.");
  }

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {submitted ? (
          <div className="flex flex-col items-center text-center py-6 gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Request sent</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your request has been sent to the supplier.
              </p>
            </div>
            <Button onClick={() => handleOpenChange(false)} className="mt-2">
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Request Product Video</DialogTitle>
              <DialogDescription>
                The supplier will share a video showcasing this product from multiple angles.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 text-xs p-3 rounded-lg bg-muted/40 border border-border/40">
              <div className="min-w-0">
                <p className="text-muted-foreground">Product</p>
                <p className="font-medium text-foreground truncate">{product.name}</p>
              </div>
              <div className="min-w-0">
                <p className="text-muted-foreground">Supplier</p>
                <p className="font-medium text-foreground truncate">
                  {product.supplier?.companyName ?? "N/A"}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
              <div className="space-y-1">
                <Label htmlFor="buyerName" className="text-xs">
                  Your Name
                </Label>
                <Input id="buyerName" aria-invalid={!!errors.buyerName} {...register("buyerName")} />
                {errors.buyerName && (
                  <p className="text-xs text-destructive">{errors.buyerName.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="company" className="text-xs">
                  Company
                </Label>
                <Input id="company" aria-invalid={!!errors.company} {...register("company")} />
                {errors.company && (
                  <p className="text-xs text-destructive">{errors.company.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-xs">
                    Email
                  </Label>
                  <Input id="email" type="email" aria-invalid={!!errors.email} {...register("email")} />
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone" className="text-xs">
                    Phone
                  </Label>
                  <Input id="phone" type="tel" aria-invalid={!!errors.phone} {...register("phone")} />
                  {errors.phone && (
                    <p className="text-xs text-destructive">{errors.phone.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="message" className="text-xs">
                  Message <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="message"
                  rows={3}
                  placeholder="Any specific angles or details you'd like to see..."
                  {...register("message")}
                />
              </div>

              <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Submit Request
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
