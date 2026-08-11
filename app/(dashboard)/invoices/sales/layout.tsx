import { SalesDocumentNav } from "@/components/invoicing/SalesDocumentNav";

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SalesDocumentNav basePath="/invoices" />
      {children}
    </div>
  );
}
