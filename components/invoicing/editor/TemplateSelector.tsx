"use client";

import { cn } from "@/lib/utils";
import type { InvoiceTemplate } from "@/types/invoicing";

const TEMPLATE_OPTIONS: { id: InvoiceTemplate; label: string; description: string }[] = [
  { id: "REGULAR", label: "Regular", description: "Our standard invoice layout" },
  { id: "CLASSIC_RED", label: "Classic Red", description: "Bold editorial, warm background" },
  { id: "MINIMAL_STUDIO", label: "Minimal Studio", description: "Monochrome, spacious, typography-led" },
];

/** Selecting a card only changes which renderer the live preview (right
 * pane / preview tab) uses — it never touches form data. Thumbnails are
 * small lightweight mock-ups built from our own tokens, not the reference
 * screenshots. */
export function TemplateSelector({ value, onChange }: { value: InvoiceTemplate; onChange: (t: InvoiceTemplate) => void }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {TEMPLATE_OPTIONS.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={selected}
            className={cn(
              "rounded-xl border-2 p-2 text-left transition-colors",
              selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
            )}
          >
            <TemplateThumbnail id={opt.id} />
            <p className={cn("text-xs font-medium mt-2", selected && "text-primary")}>{opt.label}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{opt.description}</p>
          </button>
        );
      })}
    </div>
  );
}

function TemplateThumbnail({ id }: { id: InvoiceTemplate }) {
  if (id === "CLASSIC_RED") {
    return (
      <div className="aspect-[3/4] rounded-lg overflow-hidden border border-border bg-[#FBF5E9] p-2 flex flex-col gap-1">
        <div className="h-3.5 w-2/3 bg-[#B3261E] rounded-sm" />
        <div className="h-1 w-1/2 bg-[#221c14]/60 rounded-sm mt-1" />
        <div className="flex-1 mt-1 rounded-sm border border-[#221c14]/20" />
        <div className="h-1 w-full bg-[#221c14]/15 rounded-sm" />
      </div>
    );
  }
  if (id === "MINIMAL_STUDIO") {
    return (
      <div className="aspect-[3/4] rounded-lg overflow-hidden border border-border bg-white p-2 flex flex-col gap-1">
        <div className="h-1.5 w-1/2 bg-black rounded-sm" />
        <div className="h-px w-full bg-neutral-300 mt-1.5" />
        <div className="flex-1 mt-1 space-y-1">
          <div className="h-1 w-full bg-neutral-200 rounded-sm" />
          <div className="h-1 w-5/6 bg-neutral-200 rounded-sm" />
          <div className="h-1 w-2/3 bg-neutral-200 rounded-sm" />
        </div>
        <div className="h-2 w-1/3 bg-black rounded-sm self-end" />
      </div>
    );
  }
  return (
    <div className="aspect-[3/4] rounded-lg overflow-hidden border border-border bg-card p-2 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="h-2 w-1/3 bg-primary/40 rounded-sm" />
        <div className="h-2 w-1/4 bg-muted-foreground/30 rounded-sm" />
      </div>
      <div className="h-1 w-1/2 bg-muted-foreground/20 rounded-sm mt-1" />
      <div className="flex-1 mt-1 rounded-sm border border-border" />
      <div className="h-1.5 w-1/3 bg-primary/50 rounded-sm self-end" />
    </div>
  );
}
