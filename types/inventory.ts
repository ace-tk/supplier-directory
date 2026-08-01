export type StockStatus = "In Stock" | "Low Stock" | "Out of Stock";
export type ApprovalStatus = "Pending" | "Approved" | "Rejected";

export interface AdminInventoryItem {
  id: string;
  sku: string;
  productName: string;
  category: string;
  stockQty: number;
  reorderLevel: number;
  unitPrice: number;
  status: StockStatus;
  lastUpdated: string;
}

export interface InventoryHistoryEntry {
  id: string;
  itemName: string;
  action: "Restocked" | "Sold" | "Adjusted" | "Damaged";
  quantityChange: number;
  actor: string;
  date: string;
}

export interface InventoryAnalyticsSummary {
  totalSkus: number;
  totalStockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  stockTrend: { label: string; value: number }[];
  topCategories: { category: string; count: number }[];
}

export interface SupplierInventoryItem {
  id: string;
  supplierName: string;
  productName: string;
  sku: string;
  stockQty: number;
  status: StockStatus;
  lastUpdated: string;
  approvalStatus: ApprovalStatus;
}
