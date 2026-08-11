import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { AdjustmentDocumentList } from "@/components/invoicing/AdjustmentDocumentList";
import { CreateDebitNoteDialog } from "@/components/invoicing/CreateDebitNoteDialog";

export default async function FreelancerPurchaseDebitNotesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/invoices/purchase/debit-notes");

  return (
    <AdjustmentDocumentList
      basePath="/freelancer/invoices"
      types={["DEBIT_NOTE"]}
      title="Debit Notes"
      description="Manage purchase adjustments against supplier invoices."
      showTypeColumn={false}
      createAction={<CreateDebitNoteDialog basePath="/freelancer/invoices" />}
    />
  );
}
