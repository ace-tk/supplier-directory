"use client";

import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** One shared shortcut-panel shell reused for Sales/Purchases/Expenses/
 * Products/Cash & Bank/Reports — every action is a real route, and `note`
 * exists so a panel with no real backing feature (Cash & Bank) can say so
 * honestly instead of shipping dead buttons. */
export function QuickActionPanel({
  id,
  icon: Icon,
  iconClassName,
  title,
  description,
  viewAllHref,
  viewAllLabel = "View all",
  actions,
  note,
}: {
  id?: string;
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  description: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  actions: QuickAction[];
  note?: string;
}) {
  return (
    <div id={id} className="rounded-2xl border border-border bg-card p-5 space-y-3.5 scroll-mt-24">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg shrink-0", iconClassName ?? "bg-primary/10 text-primary")}>
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground truncate">{description}</p>
          </div>
        </div>
        {viewAllHref && (
          <Link href={viewAllHref} className="text-xs font-medium text-primary hover:underline flex items-center gap-1 shrink-0 pt-1">
            {viewAllLabel} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {actions.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {actions.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-muted/40 transition-colors"
            >
              <a.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{a.label}</span>
            </Link>
          ))}
        </div>
      )}

      {note && <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/60">{note}</p>}
    </div>
  );
}
