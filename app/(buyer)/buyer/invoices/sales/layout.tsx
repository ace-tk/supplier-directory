import { SalesDocumentNav } from "@/components/invoicing/SalesDocumentNav";

export default function BuyerSalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SalesDocumentNav basePath="/buyer/invoices" />
      {children}
    </div>
  );
}
