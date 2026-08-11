import { SalesDocumentNav } from "@/components/invoicing/SalesDocumentNav";

export default function FreelancerSalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SalesDocumentNav basePath="/freelancer/invoices" />
      {children}
    </div>
  );
}
