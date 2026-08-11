import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { AdjustmentDocumentList } from "@/components/invoicing/AdjustmentDocumentList";
import { CreateDebitNoteDialog } from "@/components/invoicing/CreateDebitNoteDialog";

export default async function BuyerPurchaseDebitNotesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/invoices/purchase/debit-notes");

  return (
    <AdjustmentDocumentList
      basePath="/buyer/invoices"
      types={["DEBIT_NOTE"]}
      title="Debit Notes"
      description="Manage purchase adjustments against supplier invoices."
      showTypeColumn={false}
      createAction={<CreateDebitNoteDialog basePath="/buyer/invoices" />}
    />
  );
}
