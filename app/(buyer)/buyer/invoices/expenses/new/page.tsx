import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ExpenseForm } from "@/components/invoicing/expenses/ExpenseForm";

export default async function BuyerNewExpensePage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/invoices/expenses/new");

  return <ExpenseForm basePath="/buyer/invoices" expense={null} ownerName={user.name} />;
}
