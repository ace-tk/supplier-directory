"use client";

import { useEffect, useState } from "react";
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
import { createSupplyChainAction, getBuyerOptions, getSupplierOptions, type DirectoryOption } from "@/services/supply-chain";
import { createSupplyChainSchema, type CreateSupplyChainFormValues } from "@/lib/validations/supply-chain";

interface CreateSupplyChainModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  basePath: string;
}

const EMPTY_VALUES: CreateSupplyChainFormValues = {
  name: "",
  orderName: "",
  orderNumber: "",
  buyerUserId: "",
  supplierUserId: "",
  expectedDelivery: "",
  priority: "MEDIUM",
  description: "",
};

export function CreateSupplyChainModal({ open, onOpenChange, basePath }: CreateSupplyChainModalProps) {
  const router = useRouter();
  const [buyers, setBuyers] = useState<DirectoryOption[]>([]);
  const [suppliers, setSuppliers] = useState<DirectoryOption[]>([]);

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
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    reset(EMPTY_VALUES);
    Promise.all([getBuyerOptions(), getSupplierOptions()]).then(([b, s]) => {
      setBuyers(b);
      setSuppliers(s);
    });
  }, [open, reset]);

  const priority = watch("priority");
  const buyerUserId = watch("buyerUserId");
  const supplierUserId = watch("supplierUserId");

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
              <Select value={buyerUserId} onValueChange={(v) => v && setValue("buyerUserId", v, { shouldValidate: true })}>
                <SelectTrigger id="sc-buyer" className="w-full" aria-invalid={!!errors.buyerUserId}>
                  <SelectValue placeholder="Select a buyer" />
                </SelectTrigger>
                <SelectContent>
                  {buyers.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} {b.companyName && `— ${b.companyName}`}
                    </SelectItem>
                  ))}
                  {buyers.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No buyer accounts yet</div>
                  )}
                </SelectContent>
              </Select>
              {errors.buyerUserId && <p className="text-xs text-destructive">{errors.buyerUserId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-supplier" className="text-xs">Supplier</Label>
              <Select value={supplierUserId} onValueChange={(v) => v && setValue("supplierUserId", v, { shouldValidate: true })}>
                <SelectTrigger id="sc-supplier" className="w-full" aria-invalid={!!errors.supplierUserId}>
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.companyName && `— ${s.companyName}`}
                    </SelectItem>
                  ))}
                  {suppliers.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No supplier accounts yet</div>
                  )}
                </SelectContent>
              </Select>
              {errors.supplierUserId && <p className="text-xs text-destructive">{errors.supplierUserId.message}</p>}
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
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
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
