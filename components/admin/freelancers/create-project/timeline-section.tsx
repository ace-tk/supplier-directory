"use client";

import { useFormContext, useFieldArray } from "react-hook-form";
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/portal/status-badge";
import type { CreateProjectFormValues } from "@/lib/validations/project";

const STATUS_OPTIONS = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "DELAYED", label: "Delayed" },
] as const;

const STATUS_LABELS: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label]));

export function TimelineSection() {
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<CreateProjectFormValues>();
  const { fields, append, remove, move } = useFieldArray({ control, name: "timeline" });

  function addEntry() {
    append({
      id: crypto.randomUUID(),
      title: "",
      description: "",
      date: new Date().toISOString().slice(0, 10),
      status: "NOT_STARTED",
    });
  }

  return (
    <div className="space-y-4">
      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground">No timeline entries yet. Add the first milestone for this project.</p>
      )}

      <div className="space-y-3">
        {fields.map((field, index) => {
          const status = watch(`timeline.${index}.status`);
          const entryErrors = errors.timeline?.[index];
          return (
            <div key={field.id} className="rounded-xl border border-border bg-muted/20 p-4 space-y-3 relative">
              <div className="flex items-start gap-2">
                <div className="flex flex-col items-center gap-1 pt-2 text-muted-foreground shrink-0">
                  <GripVertical className="h-3.5 w-3.5" />
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                    className="disabled:opacity-30 hover:text-foreground transition-colors"
                    aria-label="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === fields.length - 1}
                    onClick={() => move(index, index + 1)}
                    className="disabled:opacity-30 hover:text-foreground transition-colors"
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex-1 space-y-3 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold shrink-0">
                      {index + 1}
                    </span>
                    <StatusBadge status={STATUS_LABELS[status] ?? status} />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Timeline Title</Label>
                      <Input
                        placeholder="e.g. Sample approval"
                        aria-invalid={!!entryErrors?.title}
                        {...register(`timeline.${index}.title`)}
                      />
                      {entryErrors?.title && <p className="text-xs text-destructive">{entryErrors.title.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Date</Label>
                      <Input type="date" aria-invalid={!!entryErrors?.date} {...register(`timeline.${index}.date`)} />
                      {entryErrors?.date && <p className="text-xs text-destructive">{entryErrors.date.message}</p>}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5 sm:col-span-1">
                      <Label className="text-xs font-medium">Status</Label>
                      <Select
                        value={status}
                        onValueChange={(v) => v && setValue(`timeline.${index}.status`, v as (typeof STATUS_OPTIONS)[number]["value"])}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Description / Notes</Label>
                    <Textarea rows={2} placeholder="Optional details..." {...register(`timeline.${index}.description`)} />
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => remove(index)}
                  aria-label="Delete timeline entry"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addEntry}>
        <Plus className="h-3.5 w-3.5" /> Add Timeline
      </Button>
    </div>
  );
}
