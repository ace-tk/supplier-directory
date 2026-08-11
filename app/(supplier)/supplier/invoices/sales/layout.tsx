import { SalesDocumentNav } from "@/components/invoicing/SalesDocumentNav";

export default function SupplierSalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SalesDocumentNav basePath="/supplier/invoices" />
      {children}
    </div>
  );
}
