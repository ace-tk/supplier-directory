import Link from "next/link";
import { Plus, Eye } from "lucide-react";
import { getUser } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { RecordsTable, type RecordColumn } from "@/components/portal/records-table";
import { StatusBadge } from "@/components/portal/status-badge";
import { getSupplierProducts } from "@/lib/mock-data";

type SupplierProductRow = ReturnType<typeof getSupplierProducts>[number];

const columns: RecordColumn<SupplierProductRow>[] = [
  {
    key: "product",
    label: "Product",
    render: (r) => (
      <span className="flex items-center gap-3">
        <img src={r.images[0]} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
        <span className="font-medium text-foreground whitespace-normal">{r.name}</span>
      </span>
    ),
  },
  { key: "category", label: "Category", render: (r) => r.category ?? "—" },
  { key: "moq", label: "MOQ", render: (r) => r.moq ?? "—" },
  { key: "price", label: "Price Range", render: (r) => r.priceRange ?? "—" },
  {
    key: "views",
    label: "Views",
    render: (r) => (
      <span className="flex items-center gap-1 text-muted-foreground">
        <Eye className="h-3 w-3" /> {r.views}
      </span>
    ),
  },
  { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
];

export default async function SupplierProductsPage() {
  const user = await getUser();
  const products = getSupplierProducts(user?.id ?? "guest");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Manage your product catalog."
        actions={
          <Link href="/supplier/products/add">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Product
            </Button>
          </Link>
        }
      />
      <RecordsTable columns={columns} rows={products} />
    </div>
  );
}
