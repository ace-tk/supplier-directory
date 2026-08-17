import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/session";
import { getExpenseById } from "@/lib/expenses/queries";
import { ExpenseDetailView } from "@/components/invoicing/expenses/ExpenseDetailView";

export default async function BuyerExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/invoices/expenses");

  const { id } = await params;
  const expense = await getExpenseById(id);
  if (!expense || expense.ownerId !== user.id) notFound();

  return <ExpenseDetailView basePath="/buyer/invoices" expense={expense} ownerName={user.name} />;
}
