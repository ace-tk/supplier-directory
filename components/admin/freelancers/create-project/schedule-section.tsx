"use client";

import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CreateProjectFormValues } from "@/lib/validations/project";

export function ScheduleSection() {
  const {
    register,
    formState: { errors },
  } = useFormContext<CreateProjectFormValues>();

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Project Start Date</Label>
        <Input type="date" aria-invalid={!!errors.startDate} {...register("startDate")} />
        {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Target Completion Date</Label>
        <Input type="date" aria-invalid={!!errors.expectedEndDate} {...register("expectedEndDate")} />
        {errors.expectedEndDate && <p className="text-xs text-destructive">{errors.expectedEndDate.message}</p>}
      </div>
    </div>
  );
}
