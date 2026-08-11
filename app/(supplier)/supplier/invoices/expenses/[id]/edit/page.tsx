import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/session";
import { getExpenseById } from "@/lib/expenses/queries";
import { ExpenseForm } from "@/components/invoicing/expenses/ExpenseForm";

export default async function SupplierEditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login?from=/supplier/invoices/expenses");

  const { id } = await params;
  const expense = await getExpenseById(id);
  if (!expense || expense.ownerId !== user.id) notFound();

  return <ExpenseForm basePath="/supplier/invoices" expense={expense} />;
}
