import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { InvoiceReports } from "@/components/invoicing/reports/InvoiceReports";
import type { ReportKind } from "@/lib/invoicing/reports-types";

export default async function BuyerInvoiceReportsPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/invoices/reports");

  const { kind } = await searchParams;
  return <InvoiceReports basePath="/buyer/invoices" initialKind={kind as ReportKind | undefined} />;
}
