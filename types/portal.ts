export const PORTAL_CATEGORIES = [
  "Men", "Women", "Kids", "Footwear", "Bags", "Accessories",
  "Electronics", "Furniture", "Food", "Medical", "Industrial",
  "Packaging", "Agriculture", "Beauty", "Sports",
] as const;

export type PortalCategory = (typeof PORTAL_CATEGORIES)[number];

export const BUSINESS_TYPES = [
  "Manufacturer", "Exporter", "Wholesaler", "Distributor", "Retailer", "Service Provider",
] as const;

export const PORTAL_INDUSTRIES = [
  "Electronics", "Textiles", "Food & Beverage", "Furniture", "Automotive",
  "Medical", "Industrial Equipment", "Packaging", "Agriculture",
  "Beauty & Personal Care", "Fashion & Apparel", "Technology", "Other",
] as const;

export interface PortalProductInput {
  id?: string;
  name: string;
  category: string;
  moq: string;
  priceRange: string;
  description: string;
  images: UploadedFile[];
  sortOrder?: number;
}

export interface UploadedFile {
  name: string;
  url: string;
  size?: number;
  preview?: string; // local blob URL before upload
  uploading?: boolean;
}

export interface PortalDocumentInput {
  docType: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  uploading?: boolean;
}

export interface PortalFormState {
  // meta
  id: string | null;
  currentStep: number;
  isDirty: boolean;
  lastSaved: string | null;

  // Step 1 — Business Info
  companyName: string;
  businessType: string;
  industry: string;
  gst: string;
  country: string;
  state: string;
  city: string;
  website: string;
  linkedin: string;
  instagram: string;
  whatsapp: string;
  contactName: string;
  email: string;
  phone: string;
  description: string;

  // Step 2 — Categories
  categories: string[];

  // Step 3 — Products
  products: PortalProductInput[];

  // Step 4 — Documents (keyed by docType)
  documents: Record<string, PortalDocumentInput>;

  // Step 5 — preview (read-only)
}

export type PortalStep = 1 | 2 | 3 | 4 | 5;

export const STEP_LABELS: Record<number, string> = {
  1: "Business Info",
  2: "Categories",
  3: "Products",
  4: "Documents",
  5: "Preview",
};

export const DOCUMENT_TYPES = [
  { key: "logo", label: "Company Logo", accept: "image/*", icon: "🏢" },
  { key: "cover", label: "Cover Image", accept: "image/*", icon: "🖼️" },
  { key: "license", label: "Business License", accept: ".pdf,image/*", icon: "📄" },
  { key: "gst", label: "GST Certificate", accept: ".pdf,image/*", icon: "📋" },
  { key: "catalog", label: "Product Catalog", accept: ".pdf", icon: "📑" },
  { key: "certificate", label: "Other Certificate", accept: ".pdf,image/*", icon: "🏅" },
] as const;

export interface PortalApiRecord {
  id: string;
  supplierCode: string | null;
  status: string;
  companyName: string | null;
  businessType: string | null;
  industry: string | null;
  gst: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  website: string | null;
  linkedin: string | null;
  instagram: string | null;
  whatsapp: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  categories: string[];
  products: PortalApiProduct[];
  documents: PortalApiDocument[];
  createdAt: string;
  updatedAt: string;
}

export interface PortalApiProduct {
  id: string;
  name: string;
  category: string;
  moq: string | null;
  priceRange: string | null;
  description: string | null;
  images: string[];
  sortOrder: number;
}

export interface PortalApiDocument {
  id: string;
  docType: string;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
}
