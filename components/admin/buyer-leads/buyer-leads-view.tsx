"use client";

import { useState } from "react";
import { Users2, Clock, GitMerge, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatWidget } from "@/components/portal/stat-widget";
import { StatusBadge } from "@/components/portal/status-badge";
import { RecordsTable, type RecordColumn } from "@/components/portal/records-table";
import { ListToolbar } from "@/components/admin/list-toolbar";
import { LeadDetailDialog } from "@/components/admin/buyer-leads/lead-detail-dialog";
import { useSearchFilter } from "@/hooks/use-search-filter";
import { formatMockDate } from "@/lib/mock-data";
import type { BuyerLeadRecord, BuyerLeadStatus } from "@/types/buyer-lead";
import type { SUPPLIERS } from "@/data/suppliers";

const TABS: { value: string; label: string; statuses: BuyerLeadStatus[] | null }[] = [
  { value: "all", label: "All", statuses: null },
  { value: "pending", label: "Pending", statuses: ["Pending Verification"] },
  { value: "verified", label: "Verified", statuses: ["Verified"] },
  { value: "matching", label: "Supplier Matching", statuses: ["Supplier Matching", "Supplier Contacted"] },
  { value: "closed", label: "Closed", statuses: ["Closed"] },
];

interface BuyerLeadsViewProps {
  initialLeads: BuyerLeadRecord[];
  suppliers: typeof SUPPLIERS;
}

export function BuyerLeadsView({ initialLeads, suppliers }: BuyerLeadsViewProps) {
  const [leads, setLeads] = useState<BuyerLeadRecord[]>(initialLeads);
  const [activeTab, setActiveTab] = useState("all");
  const [detailTarget, setDetailTarget] = useState<BuyerLeadRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { search, setSearch, filtered } = useSearchFilter(leads, (lead, q) =>
    [lead.buyerName, lead.company, lead.requirement, lead.category ?? "", lead.country ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(q)
  );

  const activeTabDef = TABS.find((t) => t.value === activeTab)!;
  const tabFiltered = activeTabDef.statuses ? filtered.filter((l) => activeTabDef.statuses!.includes(l.status)) : filtered;

  function handleOpenDetail(lead: BuyerLeadRecord) {
    setDetailTarget(lead);
    setDetailOpen(true);
  }

  function handleUpdated(updated: BuyerLeadRecord) {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setDetailTarget(updated);
  }

  const pendingCount = leads.filter((l) => l.status === "Pending Verification").length;
  const matchingCount = leads.filter((l) => l.status === "Supplier Matching" || l.status === "Supplier Contacted").length;
  const closedCount = leads.filter((l) => l.status === "Closed").length;

  const columns: RecordColumn<BuyerLeadRecord>[] = [
    {
      key: "buyer",
      label: "Buyer",
      render: (l) => (
        <div>
          <p className="font-medium text-foreground">{l.buyerName}</p>
          <p className="text-xs text-muted-foreground">{l.company}</p>
        </div>
      ),
    },
    {
      key: "requirement",
      label: "Requirement",
      className: "max-w-xs",
      render: (l) => (
        <div>
          <p className="text-foreground line-clamp-2">{l.requirement}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {l.category && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{l.category}</span>}
            {l.quantity && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{l.quantity}</span>}
            {l.budget && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{l.budget}</span>}
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      label: "Contact",
      render: (l) => (
        <div>
          <p className="text-foreground">{l.email}</p>
          <p className="text-xs text-muted-foreground">{l.phone}</p>
        </div>
      ),
    },
    { key: "country", label: "Country", render: (l) => l.country ?? "—" },
    { key: "created", label: "Created", render: (l) => formatMockDate(l.createdAt) },
    { key: "status", label: "Status", render: (l) => <StatusBadge status={l.status} /> },
    {
      key: "actions",
      label: "",
      className: "text-right",
      render: (l) => (
        <Button variant="ghost" size="sm" onClick={() => handleOpenDetail(l)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Buyer Leads" description="Sourcing requests submitted by buyers from the Shop page." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatWidget icon={Users2} label="Total Leads" value={leads.length} />
        <StatWidget icon={Clock} label="Pending Verification" value={pendingCount} accentClassName="text-amber-500" />
        <StatWidget icon={GitMerge} label="Supplier Matching" value={matchingCount} accentClassName="text-blue-500" />
        <StatWidget icon={CheckCircle2} label="Closed" value={closedCount} accentClassName="text-emerald-500" />
      </div>

      <Tabs value={activeTab} onValueChange={(v) => v && setActiveTab(v)}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <ListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by buyer, company, requirement, category, or country..."
          />
          <RecordsTable columns={columns} rows={tabFiltered} emptyMessage="No buyer leads match your search." />
        </TabsContent>
      </Tabs>

      <LeadDetailDialog
        key={detailTarget?.id ?? "none"}
        lead={detailTarget}
        suppliers={suppliers}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={handleUpdated}
      />
    </div>
  );
}
