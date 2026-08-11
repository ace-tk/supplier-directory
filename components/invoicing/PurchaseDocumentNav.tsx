"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Secondary nav inside Purchases — Purchase Invoices / Debit Notes. See
 * SalesDocumentNav for the equivalent Sales-side component. */
export function PurchaseDocumentNav({ basePath }: { basePath: string }) {
  const pathname = usePathname();
  const purchaseBase = `${basePath}/purchase`;

  const tabs = [
    { label: "Purchase Invoices", href: purchaseBase },
    { label: "Debit Notes", href: `${purchaseBase}/debit-notes` },
  ];

  return (
    <nav className="flex items-center gap-1.5 mb-6 flex-wrap">
      {tabs.map((tab) => {
        const active = tab.href === purchaseBase ? pathname === purchaseBase : pathname.startsWith(tab.href);
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
