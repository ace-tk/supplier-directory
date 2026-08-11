import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { InvoiceList } from "@/components/invoicing/InvoiceList";

export default async function BuyerSalesInvoicesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/invoices/sales");

  return (
    <InvoiceList
      basePath="/buyer/invoices"
      types={["SALES"]}
      title="Sales Invoices"
      description="Manage invoices issued to buyers and customers."
      createAction={
        <Button className="gap-1.5" render={<Link href="/buyer/invoices/new?type=SALES" />} nativeButton={false}>
          <Plus className="h-4 w-4" /> Create Tax Invoice
        </Button>
      }
    />
  );
}
