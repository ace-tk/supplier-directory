import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/session";
import { getInvoiceById } from "@/lib/invoicing/queries";
import { resolveInvoiceAccess } from "@/lib/invoicing/permissions";
import { PrintView } from "@/components/invoicing/PrintView";

// Deliberately outside every portal route group — no AppShell, no sidebar,
// nothing to hide. Access is enforced directly via getUser() +
// resolveInvoiceAccess(), independent of which portal a request came from,
// so this one route safely serves all 4 portals.
export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) notFound();

  const access = resolveInvoiceAccess({ userId: user.id, invoice });
  if (!access.canView) notFound();

  return <PrintView invoice={invoice} />;
}
