"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Secondary nav inside Sales — Invoices / Credit Notes / Quotations.
 * Deliberately not part of the global sidebar or the primary
 * Overview/Sales/Purchases/Expenses/Reports bar (InvoiceModuleNav) — this
 * sits one level below it, scoped to the Sales section only. */
export function SalesDocumentNav({ basePath }: { basePath: string }) {
  const pathname = usePathname();
  const salesBase = `${basePath}/sales`;

  const tabs = [
    { label: "Invoices", href: salesBase },
    { label: "Credit Notes / Sales Returns", href: `${salesBase}/credit-notes` },
    { label: "Quotations / Estimates", href: `${salesBase}/quotations` },
  ];

  return (
    <nav className="flex items-center gap-1.5 mb-6 flex-wrap">
      {tabs.map((tab) => {
        const active = tab.href === salesBase ? pathname === salesBase : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
