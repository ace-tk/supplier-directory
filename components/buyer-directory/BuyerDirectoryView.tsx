"use client";

import { useMemo, useState } from "react";
import { Search, Users2, MapPin, Mail, Calendar } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { initials } from "@/utils/format";
import { formatDate } from "@/utils/format";

export interface BuyerDirectoryEntry {
  id: string;
  name: string;
  email: string;
  companyName: string | null;
  city: string | null;
  country: string | null;
  joinedAt: string;
}

export function BuyerDirectoryView({ buyers }: { buyers: BuyerDirectoryEntry[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return buyers;
    return buyers.filter((b) =>
      [b.name, b.email, b.companyName, b.city, b.country].filter(Boolean).some((v) => v!.toLowerCase().includes(q))
    );
  }, [buyers, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buyer Directory"
        description="Registered buyers on SupplyBase."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Buyer Directory" }]}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search buyers..." className="pl-8" />
        </div>
        <p className="text-sm text-muted-foreground shrink-0">
          {filtered.length} buyer{filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users2}
          title={buyers.length === 0 ? "No buyers yet" : "No buyers match your search"}
          description={buyers.length === 0 ? "Registered buyers will appear here." : "Try a different search term."}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((buyer) => (
            <div key={buyer.id} className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-card">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-sky-500/15 text-sky-600 text-sm font-semibold shrink-0">
                  {initials(buyer.companyName || buyer.name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{buyer.companyName || buyer.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{buyer.name}</p>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5 truncate">
                  <Mail className="h-3 w-3 shrink-0" /> {buyer.email}
                </p>
                {(buyer.city || buyer.country) && (
                  <p className="flex items-center gap-1.5 truncate">
                    <MapPin className="h-3 w-3 shrink-0" /> {[buyer.city, buyer.country].filter(Boolean).join(", ")}
                  </p>
                )}
                <p className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 shrink-0" /> Joined {formatDate(buyer.joinedAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
