"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { recordPaymentAction } from "@/services/payments";
import { formatMoney, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from "@/lib/invoicing/ui";
import type { PaymentMethod, PaymentRecord } from "@/types/invoicing";

export function RecordPaymentDialog({
  invoiceId,
  currency,
  balanceDue,
  onRecorded,
}: {
  invoiceId: string;
  currency: string;
  balanceDue: string;
  onRecorded: (payment: PaymentRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  // Starts unset (never a pre-picked default) — the same convention as
  // ReasonField.tsx: Base UI's Select only knows an item's display label
  // once it has actually been selected via the dropdown, so a default
  // value chosen in code would render as its raw enum string until the
  // user opens the menu themselves.
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setAmount("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setMethod("");
    setReferenceNumber("");
    setNotes("");
  }

  async function handleSubmit() {
    if (!method) return;
    setSaving(true);
    const result = await recordPaymentAction(invoiceId, {
      amount,
      paymentDate,
      method,
      referenceNumber: referenceNumber || undefined,
      notes: notes || undefined,
    });
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Payment recorded");
    onRecorded(result.data);
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="default" size="sm" className="gap-1.5" />}>
        <Plus className="h-3.5 w-3.5" /> Record Payment
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Balance due: {formatMoney(balanceDue, currency)}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Amount</Label>
              <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Payment Date</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Payment Method</Label>
            <Select value={method} onValueChange={(v) => v && setMethod(v as PaymentMethod)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a method" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHOD_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Reference Number</Label>
            <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="Transaction / cheque number (optional)" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !amount || !method} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
