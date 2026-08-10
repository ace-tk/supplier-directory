import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/session";
import { getInvoiceById } from "@/lib/invoicing/queries";
import { resolveInvoiceAccess } from "@/lib/invoicing/permissions";
import { InvoiceDetail } from "@/components/invoicing/InvoiceDetail";

export default async function FreelancerInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/invoices");

  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) notFound();

  const access = resolveInvoiceAccess({ userId: user.id, invoice });
  if (!access.canView) notFound();

  return <InvoiceDetail basePath="/freelancer/invoices" invoice={invoice} access={access} />;
}
