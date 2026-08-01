"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Boxes, Clock, AlertTriangle, PackageX, Check, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { StatWidget } from "@/components/portal/stat-widget";
import { StatusBadge } from "@/components/portal/status-badge";
import { RecordsTable, type RecordColumn } from "@/components/portal/records-table";
import { ListToolbar } from "@/components/admin/list-toolbar";
import { useSearchFilter } from "@/hooks/use-search-filter";
import { getSupplierInventory, approveSupplierInventory, rejectSupplierInventory } from "@/services/inventory-service";
import { formatMockDate } from "@/lib/mock-data";
import type { SupplierInventoryItem } from "@/types/inventory";

export default function SupplierInventoryPage() {
  const [items, setItems] = useState<SupplierInventoryItem[]>(() => getSupplierInventory());

  const { search, setSearch, filterValue, setFilterValue, filtered } = useSearchFilter(
    items,
    (item, q) => item.supplierName.toLowerCase().includes(q) || item.productName.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q),
    (item) => item.status
  );

  async function handleApprove(id: string) {
    await approveSupplierInventory(id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, approvalStatus: "Approved" } : i)));
    toast.success("Inventory update approved");
  }

  async function handleReject(id: string) {
    await rejectSupplierInventory(id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, approvalStatus: "Rejected" } : i)));
    toast.success("Inventory update rejected");
  }

  const pendingCount = items.filter((i) => i.approvalStatus === "Pending").length;
  const lowStockCount = items.filter((i) => i.status === "Low Stock").length;
  const outOfStockCount = items.filter((i) => i.status === "Out of Stock").length;

  const columns: RecordColumn<SupplierInventoryItem>[] = [
    { key: "supplier", label: "Supplier", render: (i) => i.supplierName },
    {
      key: "product",
      label: "Product",
      render: (i) => (
        <div>
          <p className="font-medium text-foreground">{i.productName}</p>
          <p className="text-xs text-muted-foreground">{i.sku}</p>
        </div>
      ),
    },
    { key: "stock", label: "Stock", render: (i) => `${i.stockQty} units` },
    { key: "status", label: "Status", render: (i) => <StatusBadge status={i.status} /> },
    { key: "updated", label: "Last Updated", render: (i) => formatMockDate(i.lastUpdated) },
    { key: "approval", label: "Approval", render: (i) => <StatusBadge status={i.approvalStatus} /> },
    {
      key: "actions",
      label: "",
      className: "text-right",
      render: (i) =>
        i.approvalStatus === "Pending" ? (
          <div className="flex items-center gap-1 justify-end">
            <Button variant="ghost" size="icon-sm" className="text-emerald-600 hover:text-emerald-700" onClick={() => handleApprove(i.id)}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" className="text-red-500 hover:text-red-600" onClick={() => handleReject(i.id)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Inventory by Supplier"
        description="Review and approve stock updates submitted by suppliers."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatWidget icon={Boxes} label="Total Items" value={items.length} />
        <StatWidget icon={Clock} label="Pending Approval" value={pendingCount} accentClassName="text-amber-500" />
        <StatWidget icon={AlertTriangle} label="Low Stock" value={lowStockCount} accentClassName="text-amber-500" />
        <StatWidget icon={PackageX} label="Out of Stock" value={outOfStockCount} accentClassName="text-red-500" />
      </div>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by supplier, product, or SKU..."
        filterValue={filterValue}
        onFilterChange={setFilterValue}
        filterLabel="All statuses"
        filterOptions={[
          { value: "In Stock", label: "In Stock" },
          { value: "Low Stock", label: "Low Stock" },
          { value: "Out of Stock", label: "Out of Stock" },
        ]}
      />

      <RecordsTable columns={columns} rows={filtered} emptyMessage="No supplier inventory updates match your search." />
    </div>
  );
}
