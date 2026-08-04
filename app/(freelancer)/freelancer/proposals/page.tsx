import { getUser } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/portal/status-badge";
import { RecordsTable, type RecordColumn } from "@/components/portal/records-table";
import { getProposalsForFreelancer } from "@/lib/freelancer-queries";
import { PROPOSAL_STATUS_LABELS, PROPOSAL_CHANNEL_LABELS, formatShortDate } from "@/lib/freelancer-ui";
import type { ProposalRecord } from "@/types/freelancer-portal";

const columns: RecordColumn<ProposalRecord>[] = [
  { key: "title", label: "Proposal Title", render: (p) => <span className="font-medium text-foreground">{p.title}</span> },
  { key: "client", label: "Client", render: (p) => <span className="text-muted-foreground">{p.clientName}</span> },
  { key: "channel", label: "Channel", render: (p) => <span className="text-muted-foreground">{PROPOSAL_CHANNEL_LABELS[p.channel]}</span> },
  { key: "date", label: "Date", render: (p) => formatShortDate(p.createdAt) },
  { key: "status", label: "Status", render: (p) => <StatusBadge status={PROPOSAL_STATUS_LABELS[p.status]} /> },
];

export default async function FreelancerProposalsPage() {
  const user = await getUser();
  const proposals = await getProposalsForFreelancer(user!.id);

  return (
    <div className="space-y-6">
      <PageHeader title="Proposals" description="Proposals sent to you by the SupplyBase team." />
      <RecordsTable columns={columns} rows={proposals} emptyMessage="No proposals received yet." />
    </div>
  );
}
