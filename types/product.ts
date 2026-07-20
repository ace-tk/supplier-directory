import { SupplierListing } from "@/lib/generated/prisma/client";

export type Product = {
  id: string;
  supplierId: string;
  name: string;
  description: string | null;
  moq: string | null;
  priceRange: string | null;
  category: string | null;
  material: string | null;
  specifications: string | null;
  country: string | null;
  leadTime: string | null;
  images: string[];
  savedCount: number;
  createdAt: Date;
  updatedAt: Date;
  supplier?: SupplierListing;
};
