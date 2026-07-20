"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Building2, Globe, User, Phone, Mail, MapPin, Link } from "lucide-react";
import { cn } from "@/lib/utils";
import { BUSINESS_TYPES, PORTAL_INDUSTRIES, type PortalFormState } from "@/types/portal";

const schema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  businessType: z.string().min(1, "Business type is required"),
  industry: z.string().min(1, "Industry is required"),
  gst: z.string().optional(),
  country: z.string().min(1, "Country is required"),
  state: z.string().optional(),
  city: z.string().min(1, "City is required"),
  website: z.string().optional(),
  linkedin: z.string().optional(),
  instagram: z.string().optional(),
  whatsapp: z.string().optional(),
  contactName: z.string().min(1, "Contact name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(5, "Phone number is required"),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface BusinessFormProps {
  state: PortalFormState;
  onChange: (partial: Partial<PortalFormState>) => void;
  onValidChange?: (valid: boolean) => void;
}

function Field({
  label, required, error, children,
}: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Input({
  className, ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full h-9 px-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground",
        "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all",
        className
      )}
      {...props}
    />
  );
}

function Textarea({
  className, ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full px-3 py-2 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground resize-none",
        "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all",
        className
      )}
      {...props}
    />
  );
}

function Select({
  className, children, ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full h-9 px-3 rounded-lg border border-input bg-background text-sm",
        "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

const sectionVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.3 } }),
};

export function BusinessForm({ state, onChange, onValidChange }: BusinessFormProps) {
  const {
    register, watch, formState: { errors, isValid },
    setValue, trigger,
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      companyName: state.companyName,
      businessType: state.businessType,
      industry: state.industry,
      gst: state.gst,
      country: state.country,
      state: state.state,
      city: state.city,
      website: state.website,
      linkedin: state.linkedin,
      instagram: state.instagram,
      whatsapp: state.whatsapp,
      contactName: state.contactName,
      email: state.email,
      phone: state.phone,
      description: state.description,
    },
    mode: "onChange",
  });

  useEffect(() => {
    onValidChange?.(isValid);
  }, [isValid, onValidChange]);

  // Sync changes up to parent
  useEffect(() => {
    const sub = watch((values) => {
      onChange({
        companyName: values.companyName ?? "",
        businessType: values.businessType ?? "",
        industry: values.industry ?? "",
        gst: values.gst ?? "",
        country: values.country ?? "",
        state: values.state ?? "",
        city: values.city ?? "",
        website: values.website ?? "",
        linkedin: values.linkedin ?? "",
        instagram: values.instagram ?? "",
        whatsapp: values.whatsapp ?? "",
        contactName: values.contactName ?? "",
        email: values.email ?? "",
        phone: values.phone ?? "",
        description: values.description ?? "",
        isDirty: true,
      });
    });
    return () => sub.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch]);

  // Trigger validation on mount so parent knows initial validity
  useEffect(() => { trigger(); }, [trigger]);

  return (
    <div className="space-y-8">
      {/* Company section */}
      <motion.div custom={0} variants={sectionVariants} initial="hidden" animate="visible">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Company Details</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Company Name" required error={errors.companyName?.message}>
            <Input placeholder="e.g. Acme Exports Pvt Ltd" {...register("companyName")} />
          </Field>
          <Field label="Business Type" required error={errors.businessType?.message}>
            <Select {...register("businessType")}>
              <option value="">Select type…</option>
              {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Industry" required error={errors.industry?.message}>
            <Select {...register("industry")}>
              <option value="">Select industry…</option>
              {PORTAL_INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
            </Select>
          </Field>
          <Field label="GST Number" error={errors.gst?.message}>
            <Input placeholder="e.g. 27AABCU9603R1ZM (optional)" {...register("gst")} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Business Description" error={errors.description?.message}>
            <Textarea
              rows={3}
              placeholder="Describe your business, products, certifications, and key differentiators…"
              {...register("description")}
            />
          </Field>
        </div>
      </motion.div>

      {/* Location section */}
      <motion.div custom={1} variants={sectionVariants} initial="hidden" animate="visible">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <MapPin className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Location</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Country" required error={errors.country?.message}>
            <Input placeholder="e.g. India" {...register("country")} />
          </Field>
          <Field label="State / Province" error={errors.state?.message}>
            <Input placeholder="e.g. Maharashtra" {...register("state")} />
          </Field>
          <Field label="City" required error={errors.city?.message}>
            <Input placeholder="e.g. Mumbai" {...register("city")} />
          </Field>
        </div>
      </motion.div>

      {/* Online presence */}
      <motion.div custom={2} variants={sectionVariants} initial="hidden" animate="visible">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <Globe className="h-3.5 w-3.5 text-violet-500" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Online Presence</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Website" error={errors.website?.message}>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="www.yourcompany.com" {...register("website")} />
            </div>
          </Field>
          <Field label="LinkedIn" error={errors.linkedin?.message}>
            <div className="relative">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="linkedin.com/company/…" {...register("linkedin")} />
            </div>
          </Field>
          <Field label="Instagram" error={errors.instagram?.message}>
            <Input placeholder="@yourbusiness" {...register("instagram")} />
          </Field>
          <Field label="WhatsApp" error={errors.whatsapp?.message}>
            <Input placeholder="+91 98000 00000" {...register("whatsapp")} />
          </Field>
        </div>
      </motion.div>

      {/* Contact */}
      <motion.div custom={3} variants={sectionVariants} initial="hidden" animate="visible">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <User className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Primary Contact</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Full Name" required error={errors.contactName?.message}>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="Contact person" {...register("contactName")} />
            </div>
          </Field>
          <Field label="Email" required error={errors.email?.message}>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-8" type="email" placeholder="contact@company.com" {...register("email")} />
            </div>
          </Field>
          <Field label="Phone" required error={errors.phone?.message}>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="+91 98000 00000" {...register("phone")} />
            </div>
          </Field>
        </div>
        {/* hidden field sync for businessType/industry selects */}
        <input type="hidden" {...register("businessType")} />
        <input type="hidden" {...register("industry")} />
      </motion.div>
    </div>
  );
}
