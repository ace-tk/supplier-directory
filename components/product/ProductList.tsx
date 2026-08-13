"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Copy, Maximize2, PackageSearch } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/portal/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordsTable, type RecordColumn } from "@/components/portal/records-table";
import { RowDetailSheet } from "@/components/catalog/RowDetailSheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getCatalogAction, deleteRowAction, duplicateRowAction } from "@/services/catalog";
import { formatMoney } from "@/lib/invoicing/ui";
import type { CatalogRecord, CatalogRowRecord, CatalogRowStatus } from "@/types/catalog";

const STATUS_OPTIONS: { value: CatalogRowStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "DRAFT", label: "Draft" },
];

type LocationFilter = "ALL" | "WAREHOUSE" | "RETAIL_STORE";

function typeLabel(row: CatalogRowRecord): string {
  if (row.locationType === "WAREHOUSE") return "Warehouse";
  if (row.locationType === "RETAIL_STORE") return "Retail Store";
  return "Unassigned";
}

function locationLabel(row: CatalogRowRecord): string {
  return row.warehouseName ?? row.retailStoreName ?? "—";
}

/**
 * The Product workspace's main screen — a friendlier view over the exact
 * same CatalogRow records Catalog Management owns (same getCatalogAction/
 * deleteRowAction/duplicateRowAction, same RowDetailSheet for "View"), not
 * a parallel product list.
 */
export function ProductList({ basePath }: { basePath: string }) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<CatalogRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("ALL");
  const [detailRow, setDetailRow] = useState<CatalogRowRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CatalogRowRecord | null>(null);

  function refresh() {
    getCatalogAction().then((result) => {
      if (result.success) setCatalog(result.data);
      else toast.error(result.error);
      setLoading(false);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  const rows = catalog?.rows ?? [];
  const categories = useMemo(() => [...new Set(rows.map((r) => r.category).filter((c): c is string => !!c))], [rows]);

  // Real persisted counts derived from the same rows the table filters —
  // never hardcoded.
  const warehouseCount = useMemo(() => rows.filter((r) => r.locationType === "WAREHOUSE").length, [rows]);
  const retailStoreCount = useMemo(() => rows.filter((r) => r.locationType === "RETAIL_STORE").length, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (locationFilter === "WAREHOUSE" && r.locationType !== "WAREHOUSE") return false;
      if (locationFilter === "RETAIL_STORE" && r.locationType !== "RETAIL_STORE") return false;
      if (statusFilter !== "All" && r.status !== statusFilter) return false;
      if (categoryFilter !== "All Categories" && r.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!r.productName.toLowerCase().includes(q) && !(r.sku ?? "").toLowerCase().includes(q) && !(r.brandName ?? "").toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, categoryFilter, locationFilter]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setCatalog((prev) => (prev ? { ...prev, rows: prev.rows.filter((r) => r.id !== deleteTarget.id) } : prev));
    const result = await deleteRowAction(deleteTarget.id);
    setDeleteTarget(null);
    if (!result.success) {
      toast.error(result.error);
      refresh();
    } else {
      toast.success("Product deleted");
    }
  }

  async function handleDuplicate(rowId: string) {
    const result = await duplicateRowAction(rowId);
    if (!result.success) return toast.error(result.error);
    setCatalog((prev) => (prev ? { ...prev, rows: [...prev.rows, result.data] } : prev));
    toast.success("Product duplicated");
  }

  const columns: RecordColumn<CatalogRowRecord>[] = [
    {
      key: "image",
      label: "",
      render: (r) =>
        r.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.images[0].dataUrl} alt="" className="w-9 h-9 rounded-lg object-cover border border-border" />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
            <PackageSearch className="h-4 w-4" />
          </div>
        ),
    },
    { key: "productName", label: "Product Name", render: (r) => <span className="font-medium text-foreground">{r.productName}</span> },
    { key: "category", label: "Category", render: (r) => r.category || "—" },
    { key: "brandName", label: "Brand", render: (r) => r.brandName || "—" },
    { key: "quantity", label: "Stock", render: (r) => <span className="tabular-nums">{r.quantity}</span> },
    { key: "price", label: "Price", render: (r) => <span className="tabular-nums">{formatMoney(String(r.priceAfterGst), r.currency)}</span> },
    { key: "gstPercent", label: "GST", render: (r) => <span className="tabular-nums">{r.gstPercent}%</span> },
    { key: "location", label: "Location", render: (r) => locationLabel(r) },
    { key: "locationType", label: "Type", render: (r) => <StatusBadge status={typeLabel(r)} /> },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusBadge status={STATUS_OPTIONS.find((o) => o.value === r.status)?.label ?? r.status} />,
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="View"
            onClick={() => {
              setDetailRow(r);
              setDetailOpen(true);
            }}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Edit"
            render={<Link href={`${basePath}/${r.id}/edit`} />}
            nativeButton={false}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Duplicate" onClick={() => handleDuplicate(r.id)}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteTarget(r)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product"
        description="Add and manage products — shared with Catalog Management and available to Invoice line items."
        actions={
          <Button className="gap-1.5" render={<Link href={`${basePath}/new`} />} nativeButton={false}>
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        }
      />

      <Tabs value={locationFilter} onValueChange={(v) => v && setLocationFilter(v as LocationFilter)}>
        <TabsList>
          <TabsTrigger value="ALL">All ({rows.length})</TabsTrigger>
          <TabsTrigger value="WAREHOUSE">Warehouse ({warehouseCount})</TabsTrigger>
          <TabsTrigger value="RETAIL_STORE">Retail Stores ({retailStoreCount})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product, SKU, or brand..." className="pl-8 w-64" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Status</SelectItem>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v) => v && setCategoryFilter(v)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Categories">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card h-64 animate-pulse" />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title={rows.length === 0 ? "No products yet" : "No products match your filters"}
          description={rows.length === 0 ? "Add your first product to get started." : "Try adjusting your search or filters."}
          action={rows.length === 0 ? { label: "Add Product", onClick: () => router.push(`${basePath}/new`) } : undefined}
        />
      ) : (
        <RecordsTable columns={columns} rows={filteredRows} />
      )}

      <RowDetailSheet
        row={detailRow}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onRowChange={(updated) => {
          setDetailRow(updated);
          setCatalog((prev) => (prev ? { ...prev, rows: prev.rows.map((r) => (r.id === updated.id ? updated : r)) } : prev));
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from Catalog Management too, and it will no longer be selectable in invoices.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
