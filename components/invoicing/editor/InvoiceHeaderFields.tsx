import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { checkInvoiceNumberAvailableAction } from "@/services/invoicing";
import { INVOICE_TYPE_LABELS } from "@/lib/invoicing/ui";
import type { EditorFormState } from "./types";

const CURRENCIES = ["INR", "USD", "EUR", "GBP"];

export function InvoiceHeaderFields({
  form,
  onChange,
  excludeId,
}: {
  form: EditorFormState;
  onChange: (patch: Partial<EditorFormState>) => void;
  /** The invoice's own id in edit mode, so it doesn't flag its own number as taken. */
  excludeId?: string;
}) {
  // UX-only early warning — see checkInvoiceNumberAvailableAction; the real
  // guarantee is the DB unique constraint + P2002 handling on save. The
  // debounced result simply overwrites whatever was shown before rather
  // than synchronously clearing it first, so a brief stale reading while
  // the user is still typing is fine and avoids a setState-in-effect churn.
  const [availability, setAvailability] = useState<"unknown" | "available" | "taken">("unknown");

  useEffect(() => {
    const number = form.invoiceNumber.trim();
    if (!number) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      checkInvoiceNumberAvailableAction(form.type, number, excludeId).then((r) => {
        if (!cancelled && r.success) setAvailability(r.data.available ? "available" : "taken");
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [form.invoiceNumber, form.type, excludeId]);

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
            aria-invalid={availability === "taken"}
          />
          {availability === "taken" && (
            <p className="text-[11px] text-destructive">This invoice number is already in use.</p>
          )}
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
