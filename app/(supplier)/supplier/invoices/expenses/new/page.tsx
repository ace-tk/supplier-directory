import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ExpenseForm } from "@/components/invoicing/expenses/ExpenseForm";

export default async function SupplierNewExpensePage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/supplier/invoices/expenses/new");

  return <ExpenseForm basePath="/supplier/invoices" expense={null} />;
}
