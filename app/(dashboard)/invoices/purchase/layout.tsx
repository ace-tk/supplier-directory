import { PurchaseDocumentNav } from "@/components/invoicing/PurchaseDocumentNav";

export default function PurchaseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <PurchaseDocumentNav basePath="/invoices" />
      {children}
    </div>
  );
}
