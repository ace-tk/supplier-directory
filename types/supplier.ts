export type Industry =
  | "Electronics"
  | "Furniture"
  | "Food & Beverage"
  | "Textiles"
  | "Packaging"
  | "Agriculture"
  | "Industrial Equipment"
  | "Medical"
  | "Automotive"
  | "Beauty & Personal Care";

export type SupplierType = "Manufacturer" | "Exporter" | "Wholesaler";

export interface Supplier {
  id: string;
  companyName: string;
  description: string;
  industry: string;
  supplierType: string;
  country: string;
  city: string;
  rating: number;
  reviewCount: number;
  verified: boolean;
  products: string[];
  responseTime: string | null;
  minimumOrder: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  whatsapp: string | null;
  linkedin: string | null;
  initials: string;
  logoColor: string;
  yearEstablished: number | null;
  employees: string | null;
  notes: string | null;
  savedCount: number;
  createdAt: string;
  updatedAt: string;
}

export type FilterKey =
  | "verified"
  | "Manufacturer"
  | "Exporter"
  | "Wholesaler"
  | "India"
  | "China"
  | "USA"
  | "Germany"
  | "Turkey"
  | "Electronics"
  | "Textiles"
  | "Food & Beverage"
  | "Furniture"
  | "Automotive";

export const INDUSTRIES: Industry[] = [
  "Electronics",
  "Furniture",
  "Food & Beverage",
  "Textiles",
  "Packaging",
  "Agriculture",
  "Industrial Equipment",
  "Medical",
  "Automotive",
  "Beauty & Personal Care",
];

export const SUPPLIER_TYPES: SupplierType[] = [
  "Manufacturer",
  "Exporter",
  "Wholesaler",
];
