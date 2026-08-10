import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { InvoiceOverview } from "@/components/invoicing/InvoiceOverview";

export default async function SupplierInvoicesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/supplier/invoices");

  return <InvoiceOverview basePath="/supplier/invoices" inventoryPath="/inventory/supplier" />;
}
