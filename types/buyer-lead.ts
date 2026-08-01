export type BuyerLeadStatus =
  | "Pending Verification"
  | "Verified"
  | "Supplier Matching"
  | "Supplier Contacted"
  | "Closed";

export interface BuyerLeadRecord {
  id: string;
  buyerName: string;
  company: string;
  email: string;
  phone: string;
  requirement: string;
  category: string | null;
  quantity: string | null;
  budget: string | null;
  country: string | null;
  status: BuyerLeadStatus;
  assignedSupplierIds: string[];
  verificationNote: string | null;
  createdAt: string;
  updatedAt: string;
}
