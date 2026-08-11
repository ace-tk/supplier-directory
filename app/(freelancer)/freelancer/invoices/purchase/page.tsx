import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { InvoiceList } from "@/components/invoicing/InvoiceList";

export default async function FreelancerPurchaseInvoicesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/invoices/purchase");

  return (
    <InvoiceList
      basePath="/freelancer/invoices"
      types={["PURCHASE"]}
      title="Purchase Invoices"
      description="Manage invoices and purchases received from suppliers."
      createAction={
        <Button className="gap-1.5" render={<Link href="/freelancer/invoices/new?type=PURCHASE" />} nativeButton={false}>
          <Plus className="h-4 w-4" /> Create Purchase Invoice
        </Button>
      }
    />
  );
}
