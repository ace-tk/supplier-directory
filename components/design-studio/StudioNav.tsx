"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { designStudioWorkflows } from "@/lib/design-studio-workflows";

const HOME_HREF = "/design-studio";

/**
 * Secondary, in-module navigation for AI Design Studio — shown on Studio
 * Home, Repeat Print Maker and Pattern Library. Garment Studio's editor is
 * deliberately full-bleed (its own immersive canvas chrome) and doesn't use
 * this bar, matching how it already escapes the main portal shell.
 */
export function StudioNav() {
  const pathname = usePathname();
  const items = [
    { id: "home", name: "Home", href: HOME_HREF, icon: Sparkles },
    ...designStudioWorkflows.filter((w) => w.status === "available"),
  ];

  return (
    <nav className="flex items-center gap-1 overflow-x-auto scrollbar-thin rounded-full border border-border bg-card p-1 w-fit max-w-full">
      {items.map((item) => {
        // Match on a path-segment boundary, not a raw string prefix — a
        // plain startsWith would also mark "/design-studio/garment" active
        // while viewing "/design-studio/garment-back-design", since the
        // latter starts with the former as a substring even though it's a
        // sibling route, not a nested one.
        const isActive = item.href === HOME_HREF ? pathname === HOME_HREF : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <item.icon className="h-3.5 w-3.5 shrink-0" />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}
