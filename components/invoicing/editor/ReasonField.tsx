import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { INVOICE_REASON_LABELS, INVOICE_REASON_OPTIONS } from "@/lib/invoicing/ui";
import type { EditorFormState } from "./types";
import type { InvoiceReason } from "@/types/invoicing";

/** Reason + Notes for adjustment documents (Credit Note/Sales Return/Debit Note). */
export function ReasonField({
  form,
  onChange,
}: {
  form: EditorFormState;
  onChange: (patch: Partial<EditorFormState>) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">Reason</h2>
      <div className="space-y-1.5">
        <Label className="text-xs">Reason</Label>
        {/* value is always a defined string ("" until chosen) — never
            switches to/from undefined, which Base UI's Select treats as an
            uncontrolled/controlled transition and warns about. */}
        <Select value={form.reason} onValueChange={(v) => v && onChange({ reason: v as InvoiceReason })}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a reason" />
          </SelectTrigger>
          <SelectContent>
            {INVOICE_REASON_OPTIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {INVOICE_REASON_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Notes</Label>
        <Textarea
          rows={2}
          value={form.customerNotes}
          onChange={(e) => onChange({ customerNotes: e.target.value })}
          placeholder="Add any additional detail (required if reason is Other)"
        />
      </div>
    </div>
  );
}
