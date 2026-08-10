import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { InvoiceOverview } from "@/components/invoicing/InvoiceOverview";

export default async function BuyerInvoicesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/invoices");

  return <InvoiceOverview basePath="/buyer/invoices" />;
}
