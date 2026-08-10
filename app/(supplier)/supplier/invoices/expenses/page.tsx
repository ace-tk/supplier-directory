import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ExpensesList } from "@/components/invoicing/expenses/ExpensesList";

export default async function SupplierInvoiceExpensesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/supplier/invoices/expenses");

  return <ExpensesList basePath="/supplier/invoices" />;
}
