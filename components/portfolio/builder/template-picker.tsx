"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PORTFOLIO_TEMPLATES } from "@/lib/portfolio-templates";
import { selectTemplateAction } from "@/services/portfolio";
import type { PortfolioViewModel } from "@/types/portfolio";

export function TemplatePicker({ data, onChange }: { data: PortfolioViewModel; onChange: (d: PortfolioViewModel) => void }) {
  const [selecting, setSelecting] = useState<string | null>(null);

  async function handleSelect(key: string) {
    setSelecting(key);
    const result = await selectTemplateAction(key);
    setSelecting(null);
    if (!result.success) return toast.error(result.error);
    onChange(result.data);
    toast.success("Template selected");
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {PORTFOLIO_TEMPLATES.map((template) => {
        const isSelected = data.templateKey === template.key;
        const isAvailable = template.availability === "AVAILABLE";
        return (
          <div
            key={template.key}
            className={cn(
              "rounded-xl border overflow-hidden flex flex-col",
              isSelected ? "border-primary ring-1 ring-primary" : "border-border"
            )}
          >
            <div className="aspect-[4/3] bg-gradient-to-br from-neutral-900 to-neutral-700 flex items-center justify-center relative">
              <span className="text-white/70 text-xs font-semibold tracking-[0.2em] uppercase">{template.name}</span>
              {isSelected && (
                <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </span>
              )}
            </div>
            <div className="p-4 space-y-2 flex-1 flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{template.name}</p>
                {!isAvailable && (
                  <span className="text-[10px] font-semibold tracking-wide uppercase text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    Coming Soon
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground flex-1">{template.description}</p>
              <Button
                size="sm"
                variant={isSelected ? "secondary" : "outline"}
                disabled={!isAvailable || isSelected || selecting === template.key}
                onClick={() => handleSelect(template.key)}
                className="gap-1.5 w-full"
              >
                {selecting === template.key && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isSelected ? "Selected" : isAvailable ? "Select Template" : "Coming Soon"}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
