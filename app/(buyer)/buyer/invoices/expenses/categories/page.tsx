import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ExpenseCategoriesPage } from "@/components/invoicing/expenses/ExpenseCategoriesPage";

export default async function BuyerInvoiceExpenseCategoriesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/invoices/expenses/categories");

  return <ExpenseCategoriesPage basePath="/buyer/invoices" />;
}
