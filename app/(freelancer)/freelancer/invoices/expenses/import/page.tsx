import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ExpenseImportPage } from "@/components/invoicing/expenses/ExpenseImportPage";

export default async function FreelancerExpenseImportPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/invoices/expenses/import");

  return <ExpenseImportPage basePath="/freelancer/invoices" />;
}
