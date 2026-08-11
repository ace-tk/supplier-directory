import { PurchaseDocumentNav } from "@/components/invoicing/PurchaseDocumentNav";

export default function BuyerPurchaseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <PurchaseDocumentNav basePath="/buyer/invoices" />
      {children}
    </div>
  );
}
