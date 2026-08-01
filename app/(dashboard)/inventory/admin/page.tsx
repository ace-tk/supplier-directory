"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Boxes, AlertTriangle, IndianRupee, PackageX, Upload, Download as DownloadIcon, Trash2, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatWidget } from "@/components/portal/stat-widget";
import { StatusBadge } from "@/components/portal/status-badge";
import { RecordsTable, type RecordColumn } from "@/components/portal/records-table";
import { ListToolbar } from "@/components/admin/list-toolbar";
import { LowStockBanner } from "@/components/admin/inventory/low-stock-banner";
import { useSearchFilter } from "@/hooks/use-search-filter";
import {
  getAdminInventory,
  getInventoryHistory,
  getInventoryAnalytics,
  deleteInventoryItem,
  bulkImportInventory,
  bulkExportInventory,
} from "@/services/inventory-service";
import { formatMockDate } from "@/lib/mock-data";
import type { AdminInventoryItem, InventoryHistoryEntry } from "@/types/inventory";

export default function AdminInventoryPage() {
  const [items, setItems] = useState<AdminInventoryItem[]>(() => getAdminInventory());
  const [history] = useState<InventoryHistoryEntry[]>(() => getInventoryHistory());
  const [analytics] = useState(() => getInventoryAnalytics());

  const { search, setSearch, filterValue, setFilterValue, filtered } = useSearchFilter(
    items,
    (item, q) => item.productName.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q) || item.category.toLowerCase().includes(q),
    (item) => item.status
  );

  async function handleDelete(id: string) {
    await deleteInventoryItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success("Product removed from inventory");
  }

  function handleImport() {
    toast.promise(bulkImportInventory(), {
      loading: "Importing inventory...",
      success: (res) => `Imported ${res.imported} items`,
      error: "Import failed",
    });
  }

  function handleExport() {
    toast.promise(bulkExportInventory(), {
      loading: "Preparing export...",
      success: (res) => `Exported to ${res.fileName}`,
      error: "Export failed",
    });
  }

  const columns: RecordColumn<AdminInventoryItem>[] = [
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
    { key: "category", label: "Category", render: (i) => i.category },
    { key: "stock", label: "Stock", render: (i) => `${i.stockQty} units` },
    { key: "price", label: "Unit Price", render: (i) => `₹${i.unitPrice.toLocaleString("en-IN")}` },
    { key: "status", label: "Status", render: (i) => <StatusBadge status={i.status} /> },
    { key: "updated", label: "Last Updated", render: (i) => formatMockDate(i.lastUpdated) },
    {
      key: "actions",
      label: "",
      className: "text-right",
      render: (i) => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="icon-sm" onClick={() => toast.info("Edit form coming soon")}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(i.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const historyColumns: RecordColumn<InventoryHistoryEntry>[] = [
    { key: "item", label: "Item", render: (h) => h.itemName },
    { key: "action", label: "Action", render: (h) => <StatusBadge status={h.action} /> },
    {
      key: "change",
      label: "Quantity Change",
      render: (h) => (
        <span className={h.quantityChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>
          {h.quantityChange >= 0 ? "+" : ""}
          {h.quantityChange}
        </span>
      ),
    },
    { key: "actor", label: "Actor", render: (h) => h.actor },
    { key: "date", label: "Date", render: (h) => formatMockDate(h.date) },
  ];

  const maxTrend = Math.max(...analytics.stockTrend.map((p) => p.value));

  return (
    <div>
      <PageHeader
        title="Inventory by Admin"
        description="Manage the full product catalog: stock levels, pricing, and history."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleImport}>
              <Upload className="h-3.5 w-3.5" /> Import
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <DownloadIcon className="h-3.5 w-3.5" /> Export
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatWidget icon={Boxes} label="Total SKUs" value={analytics.totalSkus} />
        <StatWidget
          icon={IndianRupee}
          label="Stock Value"
          value={`₹${(analytics.totalStockValue / 100000).toFixed(1)}L`}
        />
        <StatWidget icon={AlertTriangle} label="Low Stock" value={analytics.lowStockCount} accentClassName="text-amber-500" />
        <StatWidget icon={PackageX} label="Out of Stock" value={analytics.outOfStockCount} accentClassName="text-red-500" />
      </div>

      <LowStockBanner lowStockCount={analytics.lowStockCount} outOfStockCount={analytics.outOfStockCount} />

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Inventory</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <ListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by product, SKU, or category..."
            filterValue={filterValue}
            onFilterChange={setFilterValue}
            filterLabel="All statuses"
            filterOptions={[
              { value: "In Stock", label: "In Stock" },
              { value: "Low Stock", label: "Low Stock" },
              { value: "Out of Stock", label: "Out of Stock" },
            ]}
          />
          <RecordsTable columns={columns} rows={filtered} emptyMessage="No inventory items match your search." />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <RecordsTable columns={historyColumns} rows={history} emptyMessage="No inventory history yet." />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4 space-y-6">
          <div className="rounded-xl bg-card border border-border p-5">
            <p className="text-sm font-medium text-foreground mb-4">Stock Value Trend</p>
            <div className="flex items-end gap-2 h-40">
              {analytics.stockTrend.map((point) => (
                <div key={point.label} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full flex items-end h-32">
                    <div
                      className="w-full rounded-t-md bg-primary/70"
                      style={{ height: `${(point.value / maxTrend) * 100}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground">{point.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-card border border-border p-5">
            <p className="text-sm font-medium text-foreground mb-4">Top Categories by SKU Count</p>
            <div className="space-y-3">
              {analytics.topCategories.map((cat) => (
                <div key={cat.category} className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-32 shrink-0 truncate">{cat.category}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary/70 rounded-full"
                      style={{ width: `${(cat.count / analytics.topCategories[0].count) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-foreground w-6 text-right">{cat.count}</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
