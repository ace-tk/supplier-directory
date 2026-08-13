import type { CatalogRowStatus, ProductLocationType, ProductImageView } from "@/lib/generated/prisma/enums";

export type { CatalogRowStatus, ProductLocationType, ProductImageView };

export interface CatalogRowImageEntry {
  id: string;
  dataUrl: string;
  order: number;
  // Additive classification for the Product visual workspace's view tabs
  // (Front/Back/Side/Wash Care) — defaults to OTHER, never fabricated.
  view: ProductImageView;
}

export interface CatalogRowAttachmentEntry {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
}

export interface CatalogRowRecord {
  id: string;
  catalogId: string;
  category: string | null; // "Product Category" in the UI
  productName: string;
  brandName: string | null;
  sku: string | null;
  description: string | null;
  quantity: number;
  sizes: string[];
  color: string | null;
  moq: number | null;
  hsnCode: string | null;
  gstPercent: number;
  priceBeforeGst: number;
  priceAfterGst: number; // server-derived from priceBeforeGst * (1 + gstPercent/100)
  currency: string;
  shippingCost: number;
  miscCost: number;
  leadTime: string | null;
  status: CatalogRowStatus;
  notes: string | null;
  order: number;
  warehouse: string | null;
  gender: string | null;
  // Real, persisted Warehouse-vs-Retail-Store assignment (Product module).
  // `warehouse` above is the legacy free-text field Catalog Management
  // still owns — unrelated, kept separate on purpose.
  locationType: ProductLocationType | null;
  warehouseId: string | null;
  warehouseName: string | null;
  retailStoreId: string | null;
  retailStoreName: string | null;
  images: CatalogRowImageEntry[];
  attachments: CatalogRowAttachmentEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CatalogRecord {
  id: string;
  name: string;
  description: string | null;
  rows: CatalogRowRecord[];
  createdAt: string;
  updatedAt: string;
}

export const CATALOG_COLUMN_LABELS: Record<string, string> = {
  category: "Product Category",
  productName: "Product Name",
  brandName: "Brand Name",
  sku: "SKU",
  description: "Description",
  quantity: "Quantity",
  sizes: "Sizes",
  color: "Color",
  moq: "MOQ",
  hsnCode: "HSN Code",
  gstPercent: "GST / Tax %",
  priceBeforeGst: "Price Before GST",
  priceAfterGst: "Price",
  currency: "Currency",
  shippingCost: "Shipping Cost",
  miscCost: "Misc. Cost",
  leadTime: "Lead Time",
  status: "Status",
  notes: "Notes",
  warehouse: "Warehouse",
};

export const CATALOG_EXPORT_COLUMNS: (keyof CatalogRowRecord)[] = [
  "category",
  "productName",
  "brandName",
  "sku",
  "description",
  "quantity",
  "sizes",
  "color",
  "moq",
  "hsnCode",
  "gstPercent",
  "priceBeforeGst",
  "priceAfterGst",
  "currency",
  "shippingCost",
  "miscCost",
  "leadTime",
  "status",
  "notes",
  "warehouse",
];
