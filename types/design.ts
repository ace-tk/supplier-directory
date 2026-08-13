import type { ManufacturingRequestStatus } from "@/lib/generated/prisma/enums";

export type { ManufacturingRequestStatus };

/** Free-form customization choices from the Design Your Own stepper.
 * Every field is optional — only genuinely-chosen options are stored, never
 * defaulted/faked. Kept as a JSON shape (not individual CatalogRow columns)
 * per the task's own guidance: design-request-only data lives on the
 * design/request record, not the core Product model. */
export interface DesignSpecification {
  fabric?: string;
  color?: string;
  fit?: string;
  sizes?: string[];
  waist?: string;
  buttons?: string;
  pockets?: string;
  labels?: string;
  packaging?: string;
  otherDetails?: string;
}

export interface DesignAttachmentEntry {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
}

export interface ProductDesignRecord {
  id: string;
  productId: string;
  productName: string;
  ownerId: string;
  name: string;
  specification: DesignSpecification;
  notes: string | null;
  attachments: DesignAttachmentEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ManufacturingRequestRecord {
  id: string;
  productId: string;
  productName: string;
  designId: string | null;
  ownerId: string;
  specification: DesignSpecification;
  quantity: number;
  targetPrice: number | null;
  currency: string;
  sampleRequired: boolean;
  deliveryLocation: string | null;
  requiredBy: string | null;
  notes: string | null;
  status: ManufacturingRequestStatus;
  attachments: DesignAttachmentEntry[];
  createdAt: string;
  updatedAt: string;
}
