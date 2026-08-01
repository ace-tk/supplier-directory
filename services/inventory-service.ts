// Mock inventory service. Every getter/action below is written to the shape
// a real backend endpoint would return, so call sites (pages/hooks) never
// change when the mock body is swapped for a real fetch/DB call.

import { PRODUCTS } from "@/data/products";
import { SUPPLIERS } from "@/data/suppliers";
import { hashString, pick, dateAgo } from "@/lib/mock-data";
import type {
  AdminInventoryItem,
  InventoryHistoryEntry,
  InventoryAnalyticsSummary,
  SupplierInventoryItem,
  StockStatus,
} from "@/types/inventory";

function mockLatency(ms = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function statusForQty(qty: number, reorderLevel: number): StockStatus {
  if (qty === 0) return "Out of Stock";
  if (qty <= reorderLevel) return "Low Stock";
  return "In Stock";
}

// ---------------------------------------------------------------------------
// Inventory by Admin
// ---------------------------------------------------------------------------
let adminInventoryCache: AdminInventoryItem[] | null = null;

export function getAdminInventory(): AdminInventoryItem[] {
  if (adminInventoryCache) return adminInventoryCache;

  adminInventoryCache = PRODUCTS.map((product, i) => {
    const key = `inv-admin-${product.id}`;
    const reorderLevel = 20 + (hashString(`${key}-reorder`) % 30);
    const qty = hashString(`${key}-qty`) % 200;
    return {
      id: `ai-${i}`,
      sku: `SKU-${product.category.slice(0, 3).toUpperCase()}-${product.id.split("-")[1]}`,
      productName: product.name,
      category: product.category,
      stockQty: qty,
      reorderLevel,
      unitPrice: 150 + (hashString(`${key}-price`) % 900),
      status: statusForQty(qty, reorderLevel),
      lastUpdated: dateAgo(hashString(`${key}-updated`) % 30),
    };
  });

  return adminInventoryCache;
}

export function getInventoryHistory(): InventoryHistoryEntry[] {
  const actions: InventoryHistoryEntry["action"][] = ["Restocked", "Sold", "Adjusted", "Damaged"];
  const actors = ["Admin", "Warehouse Team", "System", "Priya Sharma"];
  return getAdminInventory()
    .slice(0, 20)
    .map((item, i) => {
      const key = `inv-history-${item.id}-${i}`;
      const action = pick(actions, `${key}-action`);
      const delta = 5 + (hashString(`${key}-delta`) % 80);
      return {
        id: key,
        itemName: item.productName,
        action,
        quantityChange: action === "Sold" || action === "Damaged" ? -delta : delta,
        actor: pick(actors, `${key}-actor`),
        date: dateAgo(hashString(`${key}-date`) % 45),
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getInventoryAnalytics(): InventoryAnalyticsSummary {
  const inventory = getAdminInventory();
  const months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];
  const categoryCounts = new Map<string, number>();
  for (const item of inventory) {
    categoryCounts.set(item.category, (categoryCounts.get(item.category) ?? 0) + 1);
  }

  return {
    totalSkus: inventory.length,
    totalStockValue: inventory.reduce((sum, i) => sum + i.stockQty * i.unitPrice, 0),
    lowStockCount: inventory.filter((i) => i.status === "Low Stock").length,
    outOfStockCount: inventory.filter((i) => i.status === "Out of Stock").length,
    stockTrend: months.map((label, i) => ({
      label,
      value: 4000 + (hashString(`inv-trend-${label}-${i}`) % 6000),
    })),
    topCategories: [...categoryCounts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
  };
}

// Mock mutations — swap for real `POST /api/inventory/:id` calls later.
export async function updateInventoryItem(
  id: string,
  patch: Partial<Pick<AdminInventoryItem, "stockQty" | "unitPrice">>
): Promise<{ success: true }> {
  await mockLatency();
  const inventory = getAdminInventory();
  const item = inventory.find((i) => i.id === id);
  if (item) {
    Object.assign(item, patch);
    if (patch.stockQty !== undefined) {
      item.status = statusForQty(item.stockQty, item.reorderLevel);
      item.lastUpdated = new Date().toISOString();
    }
  }
  return { success: true };
}

export async function deleteInventoryItem(id: string): Promise<{ success: true }> {
  await mockLatency();
  adminInventoryCache = getAdminInventory().filter((i) => i.id !== id);
  return { success: true };
}

export async function bulkImportInventory(): Promise<{ success: true; imported: number }> {
  await mockLatency(900);
  return { success: true, imported: getAdminInventory().length };
}

export async function bulkExportInventory(): Promise<{ success: true; fileName: string }> {
  await mockLatency(600);
  return { success: true, fileName: `inventory-export-${Date.now()}.csv` };
}

// ---------------------------------------------------------------------------
// Inventory by Supplier
// ---------------------------------------------------------------------------
let supplierInventoryCache: SupplierInventoryItem[] | null = null;

export function getSupplierInventory(): SupplierInventoryItem[] {
  if (supplierInventoryCache) return supplierInventoryCache;

  const approvals: SupplierInventoryItem["approvalStatus"][] = ["Pending", "Approved", "Approved", "Rejected"];

  supplierInventoryCache = SUPPLIERS.slice(0, 24).map((supplier, i) => {
    const product = pick(PRODUCTS, `inv-sup-${supplier.id}-${i}`);
    const key = `inv-sup-${supplier.id}`;
    const qty = hashString(`${key}-qty`) % 250;
    const reorderLevel = 25;
    return {
      id: `si-${i}`,
      supplierName: supplier.companyName,
      productName: product.name,
      sku: `SUP-${supplier.id.split("-")[1]}-${product.id.split("-")[1]}`,
      stockQty: qty,
      status: statusForQty(qty, reorderLevel),
      lastUpdated: dateAgo(hashString(`${key}-updated`) % 20),
      approvalStatus: pick(approvals, `${key}-approval`),
    };
  });

  return supplierInventoryCache;
}

// Mock mutations — swap for real `POST /api/inventory/supplier/:id/review` later.
export async function approveSupplierInventory(id: string): Promise<{ success: true }> {
  await mockLatency();
  const item = getSupplierInventory().find((i) => i.id === id);
  if (item) item.approvalStatus = "Approved";
  return { success: true };
}

export async function rejectSupplierInventory(id: string): Promise<{ success: true }> {
  await mockLatency();
  const item = getSupplierInventory().find((i) => i.id === id);
  if (item) item.approvalStatus = "Rejected";
  return { success: true };
}
