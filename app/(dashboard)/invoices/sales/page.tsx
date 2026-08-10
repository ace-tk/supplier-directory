import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { InvoiceList } from "@/components/invoicing/InvoiceList";

export default async function SalesInvoicesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/invoices/sales");

  return <InvoiceList basePath="/invoices" family="SALES" />;
}
