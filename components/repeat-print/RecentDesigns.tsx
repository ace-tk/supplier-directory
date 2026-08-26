"use client";

import { Trash2 } from "lucide-react";
import { formatRelativeTime } from "@/utils/format";
import type { RepeatPrintDesignSummary } from "@/services/repeat-print";

export function RecentDesigns({
  designs,
  onOpen,
  onDelete,
}: {
  designs: RepeatPrintDesignSummary[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (designs.length === 0) return null;

  return (
    <div className="mt-10">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recent Designs</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {designs.map((d) => (
          <div key={d.id} className="group relative rounded-xl overflow-hidden border border-border bg-card">
            <button type="button" onClick={() => onOpen(d.id)} className="block w-full text-left">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.tileImage} alt={d.name} className="w-full aspect-square object-cover" />
              <div className="p-2">
                <p className="text-xs font-semibold text-foreground truncate">{d.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {d.ownerName} · {formatRelativeTime(new Date(d.updatedAt))}
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(d.id);
              }}
              aria-label={`Delete ${d.name}`}
              className="absolute top-1.5 right-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
