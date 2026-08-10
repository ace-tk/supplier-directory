import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { InvoiceList } from "@/components/invoicing/InvoiceList";

export default async function BuyerPurchaseInvoicesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/invoices/purchase");

  return <InvoiceList basePath="/buyer/invoices" family="PURCHASE" />;
}
