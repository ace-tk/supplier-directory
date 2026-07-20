"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Loader2, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supplierSchema, type SupplierFormValues } from "@/lib/validations/supplier";
import { INDUSTRIES, SUPPLIER_TYPES, type Supplier } from "@/types/supplier";
import { cn } from "@/lib/utils";

interface SupplierFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: SupplierFormValues) => Promise<void>;
  defaultValues?: Supplier | null;
  mode: "create" | "edit";
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-xs text-destructive mt-1"
    >
      {message}
    </motion.p>
  );
}

function FormField({ label, required, children, error }: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      <FieldError message={error} />
    </div>
  );
}

function supplierToFormValues(s: Supplier): SupplierFormValues {
  return {
    companyName: s.companyName,
    description: s.description,
    industry: s.industry,
    supplierType: s.supplierType as "Manufacturer" | "Exporter" | "Wholesaler",
    country: s.country,
    city: s.city,
    products: s.products.join(", "),
    minimumOrder: s.minimumOrder ?? "",
    responseTime: s.responseTime ?? "",
    phone: s.phone ?? "",
    email: s.email ?? "",
    website: s.website ?? "",
    whatsapp: s.whatsapp ?? "",
    linkedin: s.linkedin ?? "",
    verified: s.verified,
    rating: s.rating,
    yearEstablished: s.yearEstablished ?? ("" as unknown as number),
    employees: s.employees ?? "",
    notes: s.notes ?? "",
  };
}

export function SupplierForm({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  mode,
}: SupplierFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- zodResolver type diverges from RHF Resolver generic
  } = useForm<SupplierFormValues>({ resolver: zodResolver(supplierSchema) as any });

  useEffect(() => {
    if (open) {
      if (defaultValues) {
        reset(supplierToFormValues(defaultValues));
      } else {
        reset({
          companyName: "", description: "", industry: "", supplierType: "Manufacturer",
          country: "", city: "", products: "", minimumOrder: "", responseTime: "",
          phone: "", email: "", website: "", whatsapp: "", linkedin: "",
          verified: false, rating: 0, yearEstablished: "" as unknown as number, employees: "", notes: "",
        });
      }
    }
  }, [open, defaultValues, reset]);

  async function onFormSubmit(values: SupplierFormValues) {
    await onSubmit(values);
  }

  const watchedType = watch("supplierType");
  const watchedIndustry = watch("industry");
  const watchedVerified = watch("verified");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0"
        showCloseButton={false}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-popover border-b border-border px-6 py-4 flex items-center justify-between">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {mode === "create" ? "Add Supplier" : "Edit Supplier"}
            </DialogTitle>
          </DialogHeader>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onFormSubmit)} noValidate>
          <div className="px-6 py-5 space-y-6">
            {/* Company basics */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Company Info
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Company Name" required error={errors.companyName?.message}>
                  <Input
                    placeholder="e.g. Shenzhen TechCore Electronics"
                    aria-invalid={!!errors.companyName}
                    {...register("companyName")}
                  />
                </FormField>

                <FormField label="Country" required error={errors.country?.message}>
                  <Input
                    placeholder="e.g. China"
                    aria-invalid={!!errors.country}
                    {...register("country")}
                  />
                </FormField>

                <FormField label="City" required error={errors.city?.message}>
                  <Input
                    placeholder="e.g. Shenzhen"
                    aria-invalid={!!errors.city}
                    {...register("city")}
                  />
                </FormField>

                <FormField label="Year Established" error={errors.yearEstablished?.message}>
                  <Input
                    type="number"
                    placeholder="e.g. 2008"
                    min={1800}
                    max={2100}
                    {...register("yearEstablished")}
                  />
                </FormField>

                <FormField label="Employees" error={errors.employees?.message}>
                  <Input placeholder="e.g. 200–500" {...register("employees")} />
                </FormField>
              </div>

              <FormField label="Description" required error={errors.description?.message}>
                <Textarea
                  placeholder="Describe the supplier's products, certifications, and key differentiators…"
                  rows={3}
                  aria-invalid={!!errors.description}
                  {...register("description")}
                />
              </FormField>
            </section>

            {/* Business type */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Business Type
              </h3>

              <FormField label="Supplier Type" required error={errors.supplierType?.message}>
                <div className="grid grid-cols-3 gap-2">
                  {SUPPLIER_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setValue("supplierType", type, { shouldValidate: true })}
                      className={cn(
                        "py-2 px-3 rounded-lg border text-sm font-medium transition-all duration-150",
                        watchedType === type
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-border/80"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </FormField>

              <FormField label="Industry" required error={errors.industry?.message}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {INDUSTRIES.map((ind) => (
                    <button
                      key={ind}
                      type="button"
                      onClick={() => setValue("industry", ind, { shouldValidate: true })}
                      className={cn(
                        "py-1.5 px-2.5 rounded-lg border text-xs font-medium text-left transition-all duration-150",
                        watchedIndustry === ind
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-border/80"
                      )}
                    >
                      {ind}
                    </button>
                  ))}
                </div>
              </FormField>
            </section>

            {/* Products & trade */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Products & Trade
              </h3>
              <FormField
                label="Products (comma-separated)"
                required
                error={errors.products?.message as string}
              >
                <Input
                  placeholder="Smart Speakers, IoT Sensors, LED Modules"
                  aria-invalid={!!errors.products}
                  {...register("products")}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Minimum Order" error={errors.minimumOrder?.message}>
                  <Input placeholder="e.g. $5,000" {...register("minimumOrder")} />
                </FormField>
                <FormField label="Response Time" error={errors.responseTime?.message}>
                  <Input placeholder="e.g. < 2 hours" {...register("responseTime")} />
                </FormField>
              </div>
            </section>

            {/* Contact */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Contact Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Email" error={errors.email?.message}>
                  <Input type="email" placeholder="sales@company.com" {...register("email")} />
                </FormField>
                <FormField label="Phone" error={errors.phone?.message}>
                  <Input placeholder="+86 755 8888 1234" {...register("phone")} />
                </FormField>
                <FormField label="Website" error={errors.website?.message}>
                  <Input placeholder="company.com" {...register("website")} />
                </FormField>
                <FormField label="WhatsApp" error={errors.whatsapp?.message}>
                  <Input placeholder="+86 755 8888 1234" {...register("whatsapp")} />
                </FormField>
                <FormField label="LinkedIn" error={errors.linkedin?.message}>
                  <Input placeholder="linkedin.com/company/..." {...register("linkedin")} />
                </FormField>
              </div>
            </section>

            {/* Verification & rating */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Quality & Status
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Rating (0–5)" error={errors.rating?.message}>
                  <Input
                    type="number"
                    step="0.1"
                    min={0}
                    max={5}
                    placeholder="4.5"
                    {...register("rating")}
                  />
                </FormField>
                <FormField label="Verified Status" error={errors.verified?.message}>
                  <button
                    type="button"
                    onClick={() => setValue("verified", !watchedVerified, { shouldValidate: true })}
                    className={cn(
                      "flex items-center gap-2 px-3 h-8 rounded-lg border text-sm font-medium transition-all duration-150 w-full",
                      watchedVerified
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "border-border bg-muted/30 text-muted-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-colors",
                        watchedVerified ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground"
                      )}
                    >
                      {watchedVerified && (
                        <Plus className="h-2 w-2 text-white rotate-45 hidden" />
                      )}
                    </span>
                    {watchedVerified ? "Verified Supplier" : "Not Verified"}
                  </button>
                </FormField>
              </div>
            </section>

            {/* Notes */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Internal Notes
              </h3>
              <FormField label="Notes" error={errors.notes?.message}>
                <Textarea
                  placeholder="Internal notes, vetting status, contacts, follow-up reminders…"
                  rows={3}
                  {...register("notes")}
                />
              </FormField>
            </section>
          </div>

          {/* Sticky footer */}
          <DialogFooter className="sticky bottom-0 bg-muted/50 border-t border-border rounded-b-xl px-6 py-4 flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" className="gap-1.5" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {mode === "create" ? "Adding…" : "Saving…"}
                </>
              ) : mode === "create" ? (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Add Supplier
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
