import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ExpenseCategoriesPage } from "@/components/invoicing/expenses/ExpenseCategoriesPage";

export default async function FreelancerInvoiceExpenseCategoriesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/invoices/expenses/categories");

  return <ExpenseCategoriesPage basePath="/freelancer/invoices" />;
}
