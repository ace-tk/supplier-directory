"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Search,
  Trash2,
  Copy,
  GripVertical,
  Maximize2,
  Pencil,
  Upload,
  Download,
  Loader2,
  LayoutGrid,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/portal/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RowDetailSheet } from "@/components/catalog/RowDetailSheet";
import {
  getCatalogAction,
  addRowAction,
  updateRowFieldAction,
  deleteRowAction,
  duplicateRowAction,
  reorderRowsAction,
  importRowsAction,
} from "@/services/catalog";
import { exportRowsToFile, parseFileToRows } from "@/lib/catalog-io";
import { GST_RATE_OPTIONS, computeCatalogPriceAfterGst } from "@/lib/catalog-ui";
import type { CatalogRecord, CatalogRowRecord, CatalogRowStatus } from "@/types/catalog";
import type { CatalogRowInput } from "@/lib/validations/catalog";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: { value: CatalogRowStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "DRAFT", label: "Draft" },
];
const CURRENCY_OPTIONS = ["INR", "USD", "EUR", "GBP"];

function TextCell({ value, onSave, placeholder, className }: { value: string; onSave: (v: string) => void; placeholder?: string; className?: string }) {
  const [local, setLocal] = useState(value);
  return (
    <input
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => local !== value && onSave(local)}
      className={cn("w-full bg-transparent text-sm px-2 py-1.5 rounded outline-none focus:bg-muted focus:ring-1 focus:ring-ring", className)}
    />
  );
}

function NumberCell({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [local, setLocal] = useState(String(value));
  return (
    <input
      type="number"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const n = Number(local) || 0;
        if (n !== value) onSave(n);
      }}
      className="w-full bg-transparent text-sm px-2 py-1.5 rounded outline-none focus:bg-muted focus:ring-1 focus:ring-ring tabular-nums"
    />
  );
}

function SortableRow({
  row,
  basePath,
  onFieldChange,
  onDelete,
  onDuplicate,
  onExpand,
}: {
  row: CatalogRowRecord;
  basePath: string;
  onFieldChange: (field: keyof CatalogRowInput, value: unknown) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onExpand: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <tr ref={setNodeRef} style={style} className="border-b border-border/60 hover:bg-muted/30 group">
      <td className="w-8 px-1">
        <button {...attributes} {...listeners} className="flex items-center justify-center w-6 h-6 text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing" aria-label="Drag to reorder">
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </td>
      <td className="min-w-[140px]"><TextCell value={row.category ?? ""} placeholder="Product Category" onSave={(v) => onFieldChange("category", v)} /></td>
      <td className="min-w-[180px]"><TextCell value={row.productName} placeholder="Product name" onSave={(v) => onFieldChange("productName", v)} className="font-medium" /></td>
      <td className="min-w-[130px]"><TextCell value={row.brandName ?? ""} placeholder="Brand" onSave={(v) => onFieldChange("brandName", v)} /></td>
      <td className="min-w-[110px]"><TextCell value={row.sku ?? ""} placeholder="SKU" onSave={(v) => onFieldChange("sku", v)} /></td>
      <td className="min-w-[110px]"><TextCell value={row.hsnCode ?? ""} placeholder="HSN Code" onSave={(v) => onFieldChange("hsnCode", v)} /></td>
      <td className="min-w-[90px]"><NumberCell value={row.quantity} onSave={(v) => onFieldChange("quantity", v)} /></td>
      <td className="min-w-[130px]"><TextCell value={row.sizes.join(", ")} placeholder="S, M, L" onSave={(v) => onFieldChange("sizes", v.split(",").map((s) => s.trim()).filter(Boolean))} /></td>
      <td className="min-w-[100px]"><TextCell value={row.color ?? ""} placeholder="Color" onSave={(v) => onFieldChange("color", v)} /></td>
      <td className="min-w-[80px]"><NumberCell value={row.moq ?? 0} onSave={(v) => onFieldChange("moq", v)} /></td>
      <td className="min-w-[110px]"><NumberCell value={row.priceBeforeGst} onSave={(v) => onFieldChange("priceBeforeGst", v)} /></td>
      <td className="min-w-[90px]">
        <Select value={String(row.gstPercent)} onValueChange={(v) => v && onFieldChange("gstPercent", Number(v))}>
          <SelectTrigger className="w-full h-8 border-none bg-transparent shadow-none"><SelectValue /></SelectTrigger>
          <SelectContent>
            {GST_RATE_OPTIONS.map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
          </SelectContent>
        </Select>
      </td>
      <td className="min-w-[110px] px-2 py-1.5 text-sm tabular-nums text-muted-foreground" title="Derived from Price Before GST + GST %">
        {row.priceAfterGst.toFixed(2)}
      </td>
      <td className="min-w-[90px]">
        <Select value={row.currency} onValueChange={(v) => v && onFieldChange("currency", v)}>
          <SelectTrigger className="w-full h-8 border-none bg-transparent shadow-none"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CURRENCY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </td>
      <td className="min-w-[110px]"><NumberCell value={row.shippingCost} onSave={(v) => onFieldChange("shippingCost", v)} /></td>
      <td className="min-w-[100px]"><NumberCell value={row.miscCost} onSave={(v) => onFieldChange("miscCost", v)} /></td>
      <td className="min-w-[110px]"><TextCell value={row.leadTime ?? ""} placeholder="e.g. 15 days" onSave={(v) => onFieldChange("leadTime", v)} /></td>
      <td className="min-w-[130px]">
        <Select value={row.status} onValueChange={(v) => v && onFieldChange("status", v)}>
          <SelectTrigger className="w-full h-8 border-none bg-transparent shadow-none">
            <SelectValue>
              <StatusBadge status={STATUS_OPTIONS.find((o) => o.value === row.status)?.label ?? row.status} />
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </td>
      <td className="w-40 px-1">
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Edit product"
            render={<Link href={`${basePath}/${row.id}/edit`} />}
            nativeButton={false}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Expand row" onClick={onExpand}>
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Duplicate row" onClick={onDuplicate}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" aria-label="Delete row" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

const COLUMN_HEADERS = [
  "", "Product Category", "Product Name", "Brand", "SKU", "HSN Code", "Qty", "Sizes", "Color", "MOQ",
  "Price Before GST", "GST %", "Price", "Currency", "Shipping", "Misc.", "Lead Time", "Status", "",
];

export function CatalogTable({ basePath }: { basePath: string }) {
  const [catalog, setCatalog] = useState<CatalogRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [detailRow, setDetailRow] = useState<CatalogRowRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "All" && r.status !== statusFilter) return false;
      if (categoryFilter !== "All Categories" && r.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!r.productName.toLowerCase().includes(q) && !(r.sku ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, categoryFilter]);

  function updateLocalRow(rowId: string, patch: Partial<CatalogRowRecord>) {
    setCatalog((prev) => (prev ? { ...prev, rows: prev.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)) } : prev));
  }

  async function handleAddRow() {
    const result = await addRowAction();
    if (!result.success) return toast.error(result.error);
    setCatalog((prev) => (prev ? { ...prev, rows: [...prev.rows, result.data] } : prev));
  }

  async function handleFieldChange(rowId: string, field: keyof CatalogRowInput, value: unknown) {
    const patch: Partial<CatalogRowRecord> = { [field]: value } as Partial<CatalogRowRecord>;
    // priceAfterGst is server-derived — mirror that locally so the display
    // column updates instantly instead of waiting for a refetch.
    if (field === "priceBeforeGst" || field === "gstPercent") {
      const row = catalog?.rows.find((r) => r.id === rowId);
      if (row) {
        const priceBeforeGst = field === "priceBeforeGst" ? (value as number) : row.priceBeforeGst;
        const gstPercent = field === "gstPercent" ? (value as number) : row.gstPercent;
        patch.priceAfterGst = computeCatalogPriceAfterGst(priceBeforeGst, gstPercent);
      }
    }
    updateLocalRow(rowId, patch);
    const result = await updateRowFieldAction(rowId, field, value);
    if (!result.success) toast.error(result.error);
  }

  async function handleDelete(rowId: string) {
    setCatalog((prev) => (prev ? { ...prev, rows: prev.rows.filter((r) => r.id !== rowId) } : prev));
    const result = await deleteRowAction(rowId);
    if (!result.success) {
      toast.error(result.error);
      refresh();
    }
  }

  async function handleDuplicate(rowId: string) {
    const result = await duplicateRowAction(rowId);
    if (!result.success) return toast.error(result.error);
    setCatalog((prev) => (prev ? { ...prev, rows: [...prev.rows, result.data] } : prev));
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !catalog) return;

    const oldIndex = rows.findIndex((r) => r.id === active.id);
    const newIndex = rows.findIndex((r) => r.id === over.id);
    const reordered = arrayMove(rows, oldIndex, newIndex);
    setCatalog({ ...catalog, rows: reordered });

    const result = await reorderRowsAction(reordered.map((r) => r.id));
    if (!result.success) {
      toast.error(result.error);
      refresh();
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const parsedRows = await parseFileToRows(file);
      const result = await importRowsAction(parsedRows);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Imported ${result.data.count} row${result.data.count === 1 ? "" : "s"}`);
      refresh();
    } catch {
      toast.error("Could not read that file. Make sure it's a valid CSV or Excel file.");
    } finally {
      setImporting(false);
    }
  }

  function handleExport(format: "csv" | "xlsx") {
    if (filteredRows.length === 0) {
      toast.error("There's nothing to export.");
      return;
    }
    exportRowsToFile(filteredRows, format, "catalog");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Catalog Management" description="Build and manage your product catalog like a spreadsheet." />

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button className="gap-1.5" render={<Link href={`${basePath}/new`} />} nativeButton={false}>
            <Plus className="h-4 w-4" /> Add Product
          </Button>
          <Button variant="outline" onClick={handleAddRow} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Row
          </Button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product or SKU..." className="pl-8 w-52" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Status</SelectItem>
              {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v) => v && setCategoryFilter(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All Categories">All Categories</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-1.5" disabled={importing}>{importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Import</Button>} />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => importInputRef.current?.click()}>Import CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => importInputRef.current?.click()}>Import Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input ref={importInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} />

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" /> Export</Button>} />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("csv")}>Export CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("xlsx")}>Export Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card h-64 animate-pulse" />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title={rows.length === 0 ? "Your catalog is empty" : "No rows match your filters"}
          description={rows.length === 0 ? "Add your first product row to get started." : "Try adjusting your search or filters."}
          action={rows.length === 0 ? { label: "Add Row", onClick: handleAddRow } : undefined}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <DndContext id="catalog-table" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {COLUMN_HEADERS.map((h, i) => (
                    <th key={i} className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-2 py-2 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <SortableContext items={filteredRows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {filteredRows.map((row) => (
                    <SortableRow
                      key={row.id}
                      row={row}
                      basePath={basePath}
                      onFieldChange={(field, value) => handleFieldChange(row.id, field, value)}
                      onDelete={() => handleDelete(row.id)}
                      onDuplicate={() => handleDuplicate(row.id)}
                      onExpand={() => {
                        setDetailRow(row);
                        setDetailOpen(true);
                      }}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
        </div>
      )}

      <RowDetailSheet
        row={detailRow}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onRowChange={(updated) => {
          setDetailRow(updated);
          updateLocalRow(updated.id, updated);
        }}
      />
    </div>
  );
}
