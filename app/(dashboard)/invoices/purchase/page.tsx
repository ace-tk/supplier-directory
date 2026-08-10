import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { InvoiceList } from "@/components/invoicing/InvoiceList";

export default async function PurchaseInvoicesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/invoices/purchase");

  return <InvoiceList basePath="/invoices" family="PURCHASE" />;
}
