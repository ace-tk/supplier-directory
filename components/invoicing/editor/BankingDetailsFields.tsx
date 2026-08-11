import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { EditorFormState } from "./types";

/**
 * Optional — left collapsed and, if every field stays empty, no Banking
 * Details section is persisted or shown in the preview/PDF (see
 * buildInvoiceData in services/invoicing.ts and InvoicePreview's
 * hasBankingDetails check).
 */
export function BankingDetailsFields({
  form,
  onChange,
}: {
  form: EditorFormState;
  onChange: (patch: Partial<EditorFormState>) => void;
}) {
  return (
    <Accordion multiple defaultValue={[]}>
      <AccordionItem value="banking">
        <AccordionTrigger>Banking Details (Optional)</AccordionTrigger>
        <AccordionPanel className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Account Holder Name</Label>
              <Input value={form.bankAccountHolder} onChange={(e) => onChange({ bankAccountHolder: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bank Name</Label>
              <Input value={form.bankName} onChange={(e) => onChange({ bankName: e.target.value })} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Account Number</Label>
              <Input value={form.bankAccountNumber} onChange={(e) => onChange({ bankAccountNumber: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">IFSC Code</Label>
              <Input value={form.bankIfscCode} onChange={(e) => onChange({ bankIfscCode: e.target.value })} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Branch</Label>
              <Input value={form.bankBranch} onChange={(e) => onChange({ bankBranch: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">UPI ID</Label>
              <Input value={form.bankUpiId} onChange={(e) => onChange({ bankUpiId: e.target.value })} placeholder="e.g. business@upi" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Payment Instructions / Notes</Label>
            <Textarea
              rows={2}
              value={form.bankPaymentInstructions}
              onChange={(e) => onChange({ bankPaymentInstructions: e.target.value })}
              placeholder="Optional"
            />
          </div>
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  );
}
