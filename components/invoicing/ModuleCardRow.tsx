"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModuleCardDef {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}

/** The horizontal module-switcher row at the top of Invoice Management —
 * real navigation (href) or a real in-page anchor (onClick), never a
 * decorative-only card. */
export function ModuleCardRow({ modules }: { modules: ModuleCardDef[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
      {modules.map((m) => {
        const body = (
          <div
            className={cn(
              "rounded-xl border p-3 flex flex-col gap-2 h-full transition-colors",
              m.active ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/30 hover:bg-muted/40"
            )}
          >
            <div
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
                m.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              <m.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className={cn("text-xs font-semibold truncate", m.active ? "text-primary" : "text-foreground")}>{m.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">{m.description}</p>
            </div>
          </div>
        );

        return m.href ? (
          <Link key={m.key} href={m.href} className="block" aria-current={m.active ? "page" : undefined}>
            {body}
          </Link>
        ) : (
          <button key={m.key} type="button" onClick={m.onClick} className="block text-left w-full">
            {body}
          </button>
        );
      })}
    </div>
  );
}
