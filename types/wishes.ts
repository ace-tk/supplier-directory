import type { ProductWishStatus } from "@/lib/generated/prisma/enums";

export type { ProductWishStatus };

export interface WishImageEntry {
  id: string;
  dataUrl: string;
  order: number;
}

export interface ProductWishRecord {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  category: string;
  description: string;
  images: WishImageEntry[];
  targetQuantity: number | null;
  targetMoq: number | null;
  targetPrice: number | null;
  currency: string;
  material: string | null;
  colors: string[];
  sizes: string[];
  targetLocation: string | null;
  requiredBy: string | null;
  notes: string | null;
  referenceUrl: string | null;
  status: ProductWishStatus;
  createdAt: string;
  updatedAt: string;
}
