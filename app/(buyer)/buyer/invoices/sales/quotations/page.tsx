import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { QuotationList } from "@/components/invoicing/QuotationList";

export default async function BuyerSalesQuotationsPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/invoices/sales/quotations");

  return (
    <QuotationList
      basePath="/buyer/invoices"
      createAction={
        <Button className="gap-1.5" render={<Link href="/buyer/invoices/new?type=QUOTATION" />} nativeButton={false}>
          <Plus className="h-4 w-4" /> Create Quotation / Estimate
        </Button>
      }
    />
  );
}
