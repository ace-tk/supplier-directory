"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MapPin, ShieldCheck, ExternalLink, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateSupplyChainModal } from "@/components/supply-chain/CreateSupplyChainModal";
import { findMatchingSuppliersAction, type SupplierMatch } from "@/services/manufacturing";

/**
 * Real supplier matching against the actual SupplierListing directory —
 * matched on category/industry text (a real column), never a fabricated
 * percentage score. "View Supplier" sends the buyer to Browse Suppliers to
 * find this listing; "Add to Supply Chain" reuses the existing
 * CreateSupplyChainModal as-is (this only opens it — it doesn't try to
 * force a directory-only listing into that modal's registered-supplier
 * picker, which is a different, User-linked data pool).
 */
export function SupplierMatchList({ category, basePath }: { category: string; basePath: string }) {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<SupplierMatch[]>([]);
  const [supplyChainOpen, setSupplyChainOpen] = useState(false);

  // Supply Chain isn't wired up for every portal.
  const supplyChainBasePath = basePath.startsWith("/freelancer") ? null : basePath.replace(/\/product$/, "/supply-chain");

  useEffect(() => {
    findMatchingSuppliersAction(category).then((r) => {
      if (r.success) setMatches(r.data);
      setLoading(false);
    });
  }, [category]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Finding matching suppliers…
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No suppliers in the directory match &quot;{category || "this category"}&quot; yet.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {matches.map((s) => (
        <div key={s.id} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground truncate">{s.companyName}</p>
              {s.verified && <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
            </div>
            <p className="text-xs text-muted-foreground">
              {s.industry} · {s.supplierType}
            </p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" /> {s.city}, {s.country}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-primary/10 text-primary text-[11px] font-medium px-2.5 py-1">{s.matchReason}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5" render={<Link href="/directory" />} nativeButton={false}>
              <ExternalLink className="h-3.5 w-3.5" /> View
            </Button>
            {supplyChainBasePath && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSupplyChainOpen(true)}>
                <Network className="h-3.5 w-3.5" /> Add to Supply Chain
              </Button>
            )}
          </div>
        </div>
      ))}

      {supplyChainBasePath && (
        <CreateSupplyChainModal open={supplyChainOpen} onOpenChange={setSupplyChainOpen} basePath={supplyChainBasePath} />
      )}
    </div>
  );
}
