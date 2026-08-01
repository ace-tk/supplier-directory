import { getUser } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { RecordsTable, type RecordColumn } from "@/components/portal/records-table";
import { StatusBadge } from "@/components/portal/status-badge";
import { getSupplierEnquiries, formatMockDate, type EnquiryRecord } from "@/lib/mock-data";

const columns: RecordColumn<EnquiryRecord>[] = [
  { key: "buyer", label: "Buyer", render: (r) => <span className="font-medium text-foreground">{r.buyerName}</span> },
  { key: "company", label: "Company", render: (r) => r.company, className: "text-muted-foreground" },
  { key: "product", label: "Product", render: (r) => r.productName },
  { key: "message", label: "Message", render: (r) => <span className="line-clamp-1 max-w-xs whitespace-normal">{r.message}</span> },
  { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  { key: "date", label: "Date", render: (r) => formatMockDate(r.date), className: "text-muted-foreground" },
];

export default async function SupplierEnquiriesPage() {
  const user = await getUser();
  const enquiries = getSupplierEnquiries(user?.id ?? "guest");

  return (
    <div className="space-y-6">
      <PageHeader title="Buyer Enquiries" description="Messages from buyers interested in your products." />
      <RecordsTable columns={columns} rows={enquiries} />
    </div>
  );
}
