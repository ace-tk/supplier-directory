import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ExpenseImportPage } from "@/components/invoicing/expenses/ExpenseImportPage";

export default async function SupplierExpenseImportPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/supplier/invoices/expenses/import");

  return <ExpenseImportPage basePath="/supplier/invoices" />;
}
