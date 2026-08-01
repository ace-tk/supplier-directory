import { getUser } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { RecordsTable, type RecordColumn } from "@/components/portal/records-table";
import { StatusBadge } from "@/components/portal/status-badge";
import { getBuyerVideoRequests, formatMockDate, type VideoRequestRecord } from "@/lib/mock-data";

const columns: RecordColumn<VideoRequestRecord>[] = [
  { key: "product", label: "Product", render: (r) => <span className="font-medium text-foreground">{r.productName}</span> },
  { key: "supplier", label: "Supplier", render: (r) => r.counterpartyName },
  { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  { key: "date", label: "Requested", render: (r) => formatMockDate(r.date), className: "text-muted-foreground" },
];

export default async function BuyerVideoRequestsPage() {
  const user = await getUser();
  const requests = getBuyerVideoRequests(user?.id ?? "guest");

  return (
    <div className="space-y-6">
      <PageHeader title="Video Requests" description="Product videos you've requested from suppliers." />
      <RecordsTable columns={columns} rows={requests} />
    </div>
  );
}
