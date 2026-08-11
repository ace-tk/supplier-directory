"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** In-module tab bar (Overview/Sales/Purchases/Expenses) — deliberately not
 * added to the main left sidebar, which keeps a single "Invoice Management"
 * entry across all 4 portals. */
export function InvoiceModuleNav({ basePath }: { basePath: string }) {
  const pathname = usePathname();

  const tabs = [
    { label: "Overview", href: basePath },
    { label: "Sales", href: `${basePath}/sales` },
    { label: "Purchases", href: `${basePath}/purchase` },
    { label: "Expenses", href: `${basePath}/expenses` },
    { label: "Reports", href: `${basePath}/reports` },
  ];

  return (
    <nav className="flex items-center gap-1 border-b border-border mb-6 -mt-2">
      {tabs.map((tab) => {
        const active = tab.href === basePath ? pathname === basePath : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
