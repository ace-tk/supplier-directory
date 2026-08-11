import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ExpenseForm } from "@/components/invoicing/expenses/ExpenseForm";

export default async function NewExpensePage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/invoices/expenses/new");

  return <ExpenseForm basePath="/invoices" expense={null} />;
}
