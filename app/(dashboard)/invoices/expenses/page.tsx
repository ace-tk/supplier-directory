import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ExpensesList } from "@/components/invoicing/expenses/ExpensesList";

export default async function InvoiceExpensesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/invoices/expenses");

  return <ExpensesList basePath="/invoices" />;
}
