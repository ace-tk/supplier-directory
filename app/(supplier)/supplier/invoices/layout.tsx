import { InvoiceModuleNav } from "@/components/invoicing/InvoiceModuleNav";

export default function SupplierInvoicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <InvoiceModuleNav basePath="/supplier/invoices" />
      {children}
    </div>
  );
}
