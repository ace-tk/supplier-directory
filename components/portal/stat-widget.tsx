import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

interface StatWidgetProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sublabel?: string;
  accentClassName?: string;
}

export function StatWidget({ icon: Icon, label, value, sublabel, accentClassName }: StatWidgetProps) {
  return (
    <div className="rounded-xl bg-card border border-border p-4">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div
          className={cn(
            "flex items-center justify-center w-7 h-7 rounded-lg bg-muted shrink-0",
            accentClassName && "bg-primary/10"
          )}
        >
          <Icon className={cn("h-3.5 w-3.5 text-muted-foreground", accentClassName)} />
        </div>
      </div>
      <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {sublabel && <p className="text-[11px] text-muted-foreground mt-1">{sublabel}</p>}
    </div>
  );
}
