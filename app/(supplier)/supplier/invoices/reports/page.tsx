import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { InvoiceReports } from "@/components/invoicing/reports/InvoiceReports";

export default async function SupplierInvoiceReportsPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/supplier/invoices/reports");

  return <InvoiceReports basePath="/supplier/invoices" />;
}
