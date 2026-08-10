import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/session";
import { getInvoiceById } from "@/lib/invoicing/queries";
import { resolveInvoiceAccess } from "@/lib/invoicing/permissions";
import { parseStandaloneInvoiceType, resolveDerivedType } from "@/lib/invoicing/family";
import { InvoiceEditor } from "@/components/invoicing/InvoiceEditor";

export default async function NewFreelancerInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; source?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/invoices/new");

  const { type, source } = await searchParams;

  if (source) {
    const sourceInvoice = await getInvoiceById(source);
    if (!sourceInvoice) notFound();
    const access = resolveInvoiceAccess({ userId: user.id, invoice: sourceInvoice });
    if (!access.isOwner) notFound();

    const invoiceType = resolveDerivedType(sourceInvoice.type, type);
    if (!invoiceType) notFound();

    return <InvoiceEditor basePath="/freelancer/invoices" type={invoiceType} initialInvoice={null} sourceInvoice={sourceInvoice} />;
  }

  const invoiceType = parseStandaloneInvoiceType(type, false);
  return <InvoiceEditor basePath="/freelancer/invoices" type={invoiceType} initialInvoice={null} />;
}
