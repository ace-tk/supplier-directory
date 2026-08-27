"use client";

import { formatDate } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { GarmentDesignVersionRecord } from "@/services/garment-studio";

export function HistoryPanel({
  versions,
  activeVersionId,
  onSelect,
}: {
  versions: GarmentDesignVersionRecord[];
  activeVersionId: string;
  onSelect: (id: string) => void;
}) {
  const ordered = [...versions].reverse();

  return (
    <div className="h-full overflow-y-auto scrollbar-thin px-4 py-4">
      <p className="text-base font-semibold text-foreground mb-3">History</p>
      <ul className="space-y-0.5">
        {ordered.map((v, i) => {
          const number = versions.length - i;
          const active = v.id === activeVersionId;
          return (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => onSelect(v.id)}
                className={cn("w-full text-left px-2 py-2 rounded-lg transition-colors", active ? "bg-muted" : "hover:bg-muted/60")}
              >
                <p className="text-sm">
                  <span className="text-muted-foreground">{number}. </span>
                  <span className={cn("font-medium", active ? "text-primary" : "text-foreground")}>{v.label}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(v.createdAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" })}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
