import { getUser } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { RecordsTable, type RecordColumn } from "@/components/portal/records-table";
import { StatusBadge } from "@/components/portal/status-badge";
import { getSupplierCounterOffers, formatMockDate, type CounterOfferRecord } from "@/lib/mock-data";

const columns: RecordColumn<CounterOfferRecord>[] = [
  { key: "product", label: "Product", render: (r) => <span className="font-medium text-foreground">{r.productName}</span> },
  { key: "buyer", label: "Buyer", render: (r) => r.counterpartyName },
  { key: "list", label: "List Price", render: (r) => r.originalPrice, className: "text-muted-foreground" },
  { key: "offer", label: "Offer Received", render: (r) => <span className="font-medium text-foreground">{r.offerPrice}</span> },
  { key: "quantity", label: "Quantity", render: (r) => r.quantity },
  { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  { key: "date", label: "Date", render: (r) => formatMockDate(r.date), className: "text-muted-foreground" },
];

export default async function SupplierCounterOffersPage() {
  const user = await getUser();
  const offers = getSupplierCounterOffers(user?.id ?? "guest");

  return (
    <div className="space-y-6">
      <PageHeader title="Counter Offers" description="Pricing negotiations from buyers." />
      <RecordsTable columns={columns} rows={offers} />
    </div>
  );
}
