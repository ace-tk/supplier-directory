import { redirect } from "next/navigation";
import { hasTeamPermission } from "@/lib/team-auth";
import { InvoiceModuleNav } from "@/components/invoicing/InvoiceModuleNav";

export default async function InvoiceAccessLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasTeamPermission("invoice.view"))) redirect("/unauthorized");
  return <div><InvoiceModuleNav basePath="/invoices" />{children}</div>;
}
