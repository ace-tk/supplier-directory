import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { InvoiceOverview } from "@/components/invoicing/InvoiceOverview";

export default async function InvoicesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/invoices");

  return <InvoiceOverview basePath="/invoices" inventoryPath="/inventory/admin" />;
}
