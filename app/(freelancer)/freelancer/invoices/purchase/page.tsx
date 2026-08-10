import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { InvoiceList } from "@/components/invoicing/InvoiceList";

export default async function FreelancerPurchaseInvoicesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/invoices/purchase");

  return <InvoiceList basePath="/freelancer/invoices" family="PURCHASE" />;
}
