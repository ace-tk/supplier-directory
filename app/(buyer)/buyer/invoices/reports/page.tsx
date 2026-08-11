import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { InvoiceReports } from "@/components/invoicing/reports/InvoiceReports";

export default async function BuyerInvoiceReportsPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/invoices/reports");

  return <InvoiceReports basePath="/buyer/invoices" />;
}
