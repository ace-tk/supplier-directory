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
  industry: Industry;
  supplierType: SupplierType;
  country: string;
  city: string;
  rating: number;
  reviewCount: number;
  verified: boolean;
  products: string[];
  responseTime: string;
  minimumOrder: string;
  phone: string;
  email: string;
  website: string;
  whatsapp: string;
  linkedin: string;
  companyLogo?: string;
  initials: string;
  logoColor: string;
  yearEstablished: number;
  employees: string;
  savedCount: number;
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
