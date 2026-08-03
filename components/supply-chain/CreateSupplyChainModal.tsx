"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "@/hooks/use-session";
import { createSupplyChainAction } from "@/services/supply-chain";
import { createSupplyChainSchema, type CreateSupplyChainFormValues } from "@/lib/validations/supply-chain";

interface CreateSupplyChainModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  basePath: string;
}

export function CreateSupplyChainModal({ open, onOpenChange, basePath }: CreateSupplyChainModalProps) {
  const router = useRouter();
  const session = useSession();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateSupplyChainFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- zodResolver type diverges from RHF Resolver generic
    resolver: zodResolver(createSupplyChainSchema) as any,
    defaultValues: {
      name: "",
      orderName: "",
      orderNumber: "",
      buyerName: session?.role === "BUYER" ? session.name : "",
      supplierName: session?.role === "SUPPLIER" ? session.name : "",
      expectedDelivery: "",
      priority: "Medium",
      description: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: "",
        orderName: "",
        orderNumber: "",
        buyerName: session?.role === "BUYER" ? session.name : "",
        supplierName: session?.role === "SUPPLIER" ? session.name : "",
        expectedDelivery: "",
        priority: "Medium",
        description: "",
      });
    }
  }, [open, session, reset]);

  const priority = watch("priority");

  async function onSubmit(values: CreateSupplyChainFormValues) {
    const result = await createSupplyChainAction({ ...values, description: values.description ?? "" });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Supply chain created");
    onOpenChange(false);
    router.push(`${basePath}/${result.data.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Create Supply Chain
          </DialogTitle>
          <DialogDescription>Set up a new order lifecycle to track from confirmation to delivery.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="sc-name" className="text-xs">Supply Chain Name</Label>
            <Input id="sc-name" placeholder="e.g. Winter Hoodie Program" aria-invalid={!!errors.name} {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sc-order-name" className="text-xs">Order Name</Label>
              <Input id="sc-order-name" placeholder="e.g. Cotton Hoodies — Batch 4" aria-invalid={!!errors.orderName} {...register("orderName")} />
              {errors.orderName && <p className="text-xs text-destructive">{errors.orderName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-order-number" className="text-xs">Order Number</Label>
              <Input id="sc-order-number" placeholder="e.g. PO-88214" aria-invalid={!!errors.orderNumber} {...register("orderNumber")} />
              {errors.orderNumber && <p className="text-xs text-destructive">{errors.orderNumber.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sc-buyer" className="text-xs">Buyer</Label>
              <Input id="sc-buyer" placeholder="Buyer name" aria-invalid={!!errors.buyerName} {...register("buyerName")} />
              {errors.buyerName && <p className="text-xs text-destructive">{errors.buyerName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-supplier" className="text-xs">Supplier</Label>
              <Input id="sc-supplier" placeholder="Supplier name" aria-invalid={!!errors.supplierName} {...register("supplierName")} />
              {errors.supplierName && <p className="text-xs text-destructive">{errors.supplierName.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sc-delivery" className="text-xs">Expected Delivery Date</Label>
              <Input id="sc-delivery" type="date" aria-invalid={!!errors.expectedDelivery} {...register("expectedDelivery")} />
              {errors.expectedDelivery && <p className="text-xs text-destructive">{errors.expectedDelivery.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-priority" className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={(v) => v && setValue("priority", v as CreateSupplyChainFormValues["priority"])}>
                <SelectTrigger id="sc-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sc-description" className="text-xs">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea id="sc-description" rows={3} placeholder="Any context worth capturing about this order..." {...register("description")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-1.5">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Supply Chain
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
