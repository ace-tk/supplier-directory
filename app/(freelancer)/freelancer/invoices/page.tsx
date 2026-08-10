import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { InvoiceOverview } from "@/components/invoicing/InvoiceOverview";

export default async function FreelancerInvoicesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/invoices");

  return <InvoiceOverview basePath="/freelancer/invoices" />;
}
