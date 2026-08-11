import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { InvoiceReports } from "@/components/invoicing/reports/InvoiceReports";

export default async function InvoiceReportsPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/invoices/reports");

  return <InvoiceReports basePath="/invoices" />;
}
