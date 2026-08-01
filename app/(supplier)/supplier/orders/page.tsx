import { getUser } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { RecordsTable, type RecordColumn } from "@/components/portal/records-table";
import { StatusBadge } from "@/components/portal/status-badge";
import { getSupplierOrders, formatMockDate, type OrderRecord } from "@/lib/mock-data";

const columns: RecordColumn<OrderRecord>[] = [
  { key: "id", label: "Order", render: (r) => <span className="font-medium text-foreground">{r.id}</span> },
  { key: "product", label: "Product", render: (r) => r.productName },
  { key: "buyer", label: "Buyer", render: (r) => r.counterpartyName },
  { key: "quantity", label: "Quantity", render: (r) => r.quantity },
  { key: "total", label: "Total", render: (r) => <span className="font-medium text-foreground">{r.total}</span> },
  { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  { key: "date", label: "Date", render: (r) => formatMockDate(r.date), className: "text-muted-foreground" },
];

export default async function SupplierOrdersPage() {
  const user = await getUser();
  const orders = getSupplierOrders(user?.id ?? "guest");

  return (
    <div className="space-y-6">
      <PageHeader title="Orders" description="Orders placed by buyers against your catalog." />
      <RecordsTable columns={columns} rows={orders} />
    </div>
  );
}
