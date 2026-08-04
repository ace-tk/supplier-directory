"use client";

import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CreateProjectFormValues } from "@/lib/validations/project";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ProjectDetailsSection() {
  const {
    register,
    formState: { errors },
  } = useFormContext<CreateProjectFormValues>();

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Project / Task Name" error={errors.name?.message}>
          <Input placeholder="e.g. Q3 Product Photoshoot" aria-invalid={!!errors.name} {...register("name")} />
        </Field>
        <Field label="Client Name" error={errors.clientName?.message}>
          <Input placeholder="e.g. Acme Corp" aria-invalid={!!errors.clientName} {...register("clientName")} />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="City" error={errors.city?.message}>
          <Input placeholder="e.g. Mumbai" {...register("city")} />
        </Field>
        <Field label="Point of Contact" error={errors.pointOfContact?.message}>
          <Input placeholder="Contact person's name" {...register("pointOfContact")} />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="WhatsApp Number" error={errors.whatsapp?.message}>
          <Input placeholder="+91 98765 43210" aria-invalid={!!errors.whatsapp} {...register("whatsapp")} />
        </Field>
        <Field label="Email Address" error={errors.email?.message}>
          <Input type="email" placeholder="contact@client.com" aria-invalid={!!errors.email} {...register("email")} />
        </Field>
      </div>

      <Field label="LinkedIn Profile" error={errors.linkedinUrl?.message}>
        <Input placeholder="https://linkedin.com/in/..." aria-invalid={!!errors.linkedinUrl} {...register("linkedinUrl")} />
      </Field>

      <Field label="Notes" error={errors.notes?.message}>
        <Textarea rows={4} placeholder="Any additional context for this project..." {...register("notes")} />
      </Field>
    </div>
  );
}
