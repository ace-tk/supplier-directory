import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { AdjustmentDocumentList } from "@/components/invoicing/AdjustmentDocumentList";
import { CreateAdjustmentDialog } from "@/components/invoicing/CreateAdjustmentDialog";

export default async function FreelancerSalesCreditNotesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/invoices/sales/credit-notes");

  return (
    <AdjustmentDocumentList
      basePath="/freelancer/invoices"
      types={["CREDIT_NOTE", "SALES_RETURN"]}
      title="Credit Notes / Sales Returns"
      description="Manage adjustments and returns against existing sales invoices."
      showTypeColumn
      createAction={<CreateAdjustmentDialog basePath="/freelancer/invoices" />}
    />
  );
}
