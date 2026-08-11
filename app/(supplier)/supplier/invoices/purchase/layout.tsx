import { PurchaseDocumentNav } from "@/components/invoicing/PurchaseDocumentNav";

export default function SupplierPurchaseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <PurchaseDocumentNav basePath="/supplier/invoices" />
      {children}
    </div>
  );
}
