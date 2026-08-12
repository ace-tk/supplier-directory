import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ExpenseCategoriesPage } from "@/components/invoicing/expenses/ExpenseCategoriesPage";

export default async function SupplierInvoiceExpenseCategoriesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/supplier/invoices/expenses/categories");

  return <ExpenseCategoriesPage basePath="/supplier/invoices" />;
}
