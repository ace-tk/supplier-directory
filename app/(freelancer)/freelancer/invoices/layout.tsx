import { InvoiceModuleNav } from "@/components/invoicing/InvoiceModuleNav";

export default function FreelancerInvoicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <InvoiceModuleNav basePath="/freelancer/invoices" />
      {children}
    </div>
  );
}
