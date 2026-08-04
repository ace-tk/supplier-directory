import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { InvoiceDashboard } from "@/components/invoices/InvoiceDashboard";

export default async function BuyerInvoicesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/invoices");

  return <InvoiceDashboard />;
}
