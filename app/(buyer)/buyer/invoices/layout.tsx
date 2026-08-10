import { InvoiceModuleNav } from "@/components/invoicing/InvoiceModuleNav";

export default function BuyerInvoicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <InvoiceModuleNav basePath="/buyer/invoices" />
      {children}
    </div>
  );
}
