import type { CatalogRowStatus } from "@/lib/generated/prisma/enums";

export type { CatalogRowStatus };

export interface CatalogRowImageEntry {
  id: string;
  dataUrl: string;
  order: number;
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
  category: string | null;
  productName: string;
  sku: string | null;
  description: string | null;
  quantity: number;
  sizes: string[];
  color: string | null;
  moq: number | null;
  priceBeforeGst: number;
  priceAfterGst: number;
  currency: string;
  shippingCost: number;
  miscCost: number;
  leadTime: string | null;
  status: CatalogRowStatus;
  notes: string | null;
  order: number;
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
  category: "Category",
  productName: "Product Name",
  sku: "SKU",
  description: "Description",
  quantity: "Quantity",
  sizes: "Sizes",
  color: "Color",
  moq: "MOQ",
  priceBeforeGst: "Price Before GST",
  priceAfterGst: "Price After GST",
  currency: "Currency",
  shippingCost: "Shipping Cost",
  miscCost: "Misc. Cost",
  leadTime: "Lead Time",
  status: "Status",
  notes: "Notes",
};

export const CATALOG_EXPORT_COLUMNS: (keyof CatalogRowRecord)[] = [
  "category",
  "productName",
  "sku",
  "description",
  "quantity",
  "sizes",
  "color",
  "moq",
  "priceBeforeGst",
  "priceAfterGst",
  "currency",
  "shippingCost",
  "miscCost",
  "leadTime",
  "status",
  "notes",
];
