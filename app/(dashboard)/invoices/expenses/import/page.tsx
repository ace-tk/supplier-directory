import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { ExpenseImportPage } from "@/components/invoicing/expenses/ExpenseImportPage";

export default async function ExpenseImportRoutePage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/invoices/expenses/import");

  return <ExpenseImportPage basePath="/invoices" />;
}
