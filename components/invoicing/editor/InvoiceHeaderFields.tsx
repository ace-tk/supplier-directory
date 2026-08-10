import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INVOICE_TYPE_LABELS } from "@/lib/invoicing/ui";
import type { EditorFormState } from "./types";

const CURRENCIES = ["INR", "USD", "EUR", "GBP"];

export function InvoiceHeaderFields({
  form,
  onChange,
}: {
  form: EditorFormState;
  onChange: (patch: Partial<EditorFormState>) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">{INVOICE_TYPE_LABELS[form.type]} Details</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Invoice Number</Label>
          <Input
            value={form.invoiceNumber}
            onChange={(e) => onChange({ invoiceNumber: e.target.value })}
            className="font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Currency</Label>
          <Select value={form.currency} onValueChange={(v) => v && onChange({ currency: v })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Invoice Date</Label>
          <Input type="date" value={form.invoiceDate} onChange={(e) => onChange({ invoiceDate: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Due Date</Label>
          <Input type="date" value={form.dueDate} onChange={(e) => onChange({ dueDate: e.target.value })} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Payment Terms</Label>
          <Input
            value={form.paymentTerms}
            onChange={(e) => onChange({ paymentTerms: e.target.value })}
            placeholder="e.g. Net 30"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Reference / PO Number</Label>
          <Input
            value={form.referenceNumber}
            onChange={(e) => onChange({ referenceNumber: e.target.value })}
            placeholder="Optional"
          />
        </div>
      </div>
    </div>
  );
}
