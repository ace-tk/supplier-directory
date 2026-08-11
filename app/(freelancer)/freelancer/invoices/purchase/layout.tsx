import { PurchaseDocumentNav } from "@/components/invoicing/PurchaseDocumentNav";

export default function FreelancerPurchaseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <PurchaseDocumentNav basePath="/freelancer/invoices" />
      {children}
    </div>
  );
}
