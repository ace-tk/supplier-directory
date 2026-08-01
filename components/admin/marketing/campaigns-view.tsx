"use client";

import { toast } from "sonner";
import { Megaphone, Users2, MousePointerClick, Mail } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { StatWidget } from "@/components/portal/stat-widget";
import { StatusBadge } from "@/components/portal/status-badge";
import { RecordsTable, type RecordColumn } from "@/components/portal/records-table";
import { ListToolbar } from "@/components/admin/list-toolbar";
import { useSearchFilter } from "@/hooks/use-search-filter";
import { createCampaign } from "@/services/marketing-service";
import { formatMockDate } from "@/lib/mock-data";
import type { CampaignRecord } from "@/types/marketing";

interface CampaignsViewProps {
  title: string;
  description: string;
  campaigns: CampaignRecord[];
  showChannelColumn?: boolean;
}

export function CampaignsView({ title, description, campaigns, showChannelColumn = true }: CampaignsViewProps) {
  const { search, setSearch, filterValue, setFilterValue, filtered } = useSearchFilter(
    campaigns,
    (c, q) => c.name.toLowerCase().includes(q) || c.channel.toLowerCase().includes(q),
    (c) => c.status
  );

  function handleNewCampaign() {
    toast.promise(createCampaign(), {
      loading: "Creating campaign...",
      success: "Campaign draft created",
      error: "Failed to create campaign",
    });
  }

  const totalRecipients = campaigns.reduce((sum, c) => sum + c.recipients, 0);
  const avgOpenRate = campaigns.length
    ? Math.round(campaigns.reduce((sum, c) => sum + c.openRate, 0) / campaigns.length)
    : 0;
  const avgClickRate = campaigns.length
    ? Math.round(campaigns.reduce((sum, c) => sum + c.clickRate, 0) / campaigns.length)
    : 0;

  const columns: RecordColumn<CampaignRecord>[] = [
    { key: "name", label: "Campaign", render: (c) => <span className="font-medium text-foreground">{c.name}</span> },
    ...(showChannelColumn
      ? [{ key: "channel", label: "Channel", render: (c: CampaignRecord) => c.channel } as RecordColumn<CampaignRecord>]
      : []),
    { key: "audience", label: "Audience", render: (c) => c.audience },
    { key: "status", label: "Status", render: (c) => <StatusBadge status={c.status} /> },
    { key: "recipients", label: "Recipients", render: (c) => c.recipients.toLocaleString("en-IN") },
    { key: "open", label: "Open Rate", render: (c) => `${c.openRate}%` },
    { key: "click", label: "Click Rate", render: (c) => `${c.clickRate}%` },
    { key: "date", label: "Scheduled", render: (c) => formatMockDate(c.scheduledDate) },
  ];

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button size="sm" onClick={handleNewCampaign}>
            <Megaphone className="h-3.5 w-3.5" /> New Campaign
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatWidget icon={Megaphone} label="Campaigns" value={campaigns.length} />
        <StatWidget icon={Users2} label="Total Recipients" value={totalRecipients.toLocaleString("en-IN")} />
        <StatWidget icon={Mail} label="Avg Open Rate" value={`${avgOpenRate}%`} accentClassName="text-emerald-500" />
        <StatWidget icon={MousePointerClick} label="Avg Click Rate" value={`${avgClickRate}%`} accentClassName="text-blue-500" />
      </div>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search campaigns..."
        filterValue={filterValue}
        onFilterChange={setFilterValue}
        filterLabel="All statuses"
        filterOptions={[
          { value: "Draft", label: "Draft" },
          { value: "Scheduled", label: "Scheduled" },
          { value: "Active", label: "Active" },
          { value: "Completed", label: "Completed" },
        ]}
      />

      <RecordsTable columns={columns} rows={filtered} emptyMessage="No campaigns match your search." />
    </div>
  );
}
