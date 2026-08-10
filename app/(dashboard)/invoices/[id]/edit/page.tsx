import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/session";
import { getInvoiceById } from "@/lib/invoicing/queries";
import { resolveInvoiceAccess } from "@/lib/invoicing/permissions";
import { InvoiceEditor } from "@/components/invoicing/InvoiceEditor";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login?from=/invoices");

  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) notFound();

  const access = resolveInvoiceAccess({ userId: user.id, invoice });
  if (!access.canEdit) notFound();

  return <InvoiceEditor basePath="/invoices" type={invoice.type} initialInvoice={invoice} />;
}
