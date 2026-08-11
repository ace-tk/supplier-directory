import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ExpenseForm } from "@/components/invoicing/expenses/ExpenseForm";

export default async function FreelancerNewExpensePage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/invoices/expenses/new");

  return <ExpenseForm basePath="/freelancer/invoices" expense={null} />;
}
