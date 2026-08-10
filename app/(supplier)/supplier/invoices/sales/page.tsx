import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { InvoiceList } from "@/components/invoicing/InvoiceList";

export default async function SupplierSalesInvoicesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/supplier/invoices/sales");

  return <InvoiceList basePath="/supplier/invoices" family="SALES" />;
}
