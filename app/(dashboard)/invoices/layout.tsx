import { InvoiceModuleNav } from "@/components/invoicing/InvoiceModuleNav";

export default function InvoicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <InvoiceModuleNav basePath="/invoices" />
      {children}
    </div>
  );
}
