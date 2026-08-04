import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { InvoiceDashboard } from "@/components/invoices/InvoiceDashboard";

export default async function InvoicesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/invoices");

  return <InvoiceDashboard />;
}
