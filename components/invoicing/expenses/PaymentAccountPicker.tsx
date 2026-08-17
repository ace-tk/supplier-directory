"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandInput } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { listPaymentAccountsAction, createPaymentAccountAction } from "@/services/expenses";
import { PAYMENT_METHOD_LABELS } from "@/lib/invoicing/ui";
import { cn } from "@/lib/utils";
import type { PaymentAccountOption, PaymentMethod } from "@/types/expense";

const REFERENCE_LABEL: Partial<Record<PaymentMethod, string>> = {
  CHEQUE: "Cheque Number",
  BANK_TRANSFER: "Reference / Transaction ID",
  UPI: "Reference / Transaction ID",
  CARD: "Reference / Transaction ID",
};

export function PaymentAccountPicker({
  paymentMethod,
  paymentAccountId,
  paymentAccountLabel,
  paymentAccountProvider,
  referenceNumber,
  onAccountChange,
  onReferenceChange,
}: {
  paymentMethod: PaymentMethod | null;
  paymentAccountId: string | null;
  paymentAccountLabel: string;
  paymentAccountProvider: string;
  referenceNumber: string;
  onAccountChange: (id: string | null, label: string, provider: string) => void;
  onReferenceChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<PaymentAccountOption[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newProvider, setNewProvider] = useState("");
  const [newLast4, setNewLast4] = useState("");

  // Adjusted during render (not in an effect) so switching transaction type
  // never briefly shows the previous type's accounts.
  const [prevPaymentMethod, setPrevPaymentMethod] = useState(paymentMethod);
  if (paymentMethod !== prevPaymentMethod) {
    setPrevPaymentMethod(paymentMethod);
    setAccounts([]);
  }

  useEffect(() => {
    if (!paymentMethod || paymentMethod === "CASH") return;
    let cancelled = false;
    listPaymentAccountsAction(paymentMethod).then((r) => {
      if (!cancelled && r.success) setAccounts(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [paymentMethod]);

  async function handleCreate() {
    if (!paymentMethod || !newLabel.trim() || saving) return;
    setSaving(true);
    try {
      const result = await createPaymentAccountAction({
        label: newLabel.trim(),
        type: paymentMethod,
        provider: newProvider.trim() || undefined,
        last4: newLast4.trim() || undefined,
      });
      if (!result.success) return toast.error(result.error);
      setAccounts((prev) => [...prev, result.data]);
      onAccountChange(result.data.id, result.data.label, result.data.provider ?? "");
      setAddOpen(false);
      setNewLabel("");
      setNewProvider("");
      setNewLast4("");
    } finally {
      setSaving(false);
    }
  }

  if (!paymentMethod || paymentMethod === "CASH") {
    return null;
  }

  const referenceLabel = REFERENCE_LABEL[paymentMethod];

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Payment Method / Paid By</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger render={<Button variant="outline" className="w-full justify-between font-normal" />}>
              <span className="truncate">{paymentAccountLabel || `Select ${PAYMENT_METHOD_LABELS[paymentMethod].toLowerCase()} account`}</span>
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </PopoverTrigger>
            <PopoverContent className="w-[--anchor-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search accounts..." />
                <CommandList>
                  <CommandEmpty>No accounts yet.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="none"
                      onSelect={() => {
                        onAccountChange(null, "", "");
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("h-3.5 w-3.5", !paymentAccountId ? "opacity-100" : "opacity-0")} />
                      None
                    </CommandItem>
                    {accounts.map((a) => (
                      <CommandItem
                        key={a.id}
                        value={a.label}
                        onSelect={() => {
                          onAccountChange(a.id, a.label, a.provider ?? "");
                          setOpen(false);
                        }}
                      >
                        <Check className={cn("h-3.5 w-3.5", paymentAccountId === a.id ? "opacity-100" : "opacity-0")} />
                        {a.label}
                        {a.last4 && <span className="text-muted-foreground ml-1">•••• {a.last4}</span>}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandGroup>
                    <CommandItem
                      value="add-account"
                      onSelect={() => {
                        setOpen(false);
                        setAddOpen(true);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add payment account
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Bank / Card Provider</Label>
          <Input value={paymentAccountProvider} readOnly placeholder="Auto-filled from Paid By" className="bg-muted/50" />
        </div>
      </div>

      {referenceLabel && (
        <div className="space-y-1.5">
          <Label className="text-xs">{referenceLabel}</Label>
          <Input
            value={referenceNumber}
            onChange={(e) => onReferenceChange(e.target.value)}
            placeholder={paymentMethod === "CHEQUE" ? "Enter cheque number" : "Optional"}
          />
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add payment account</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Label</Label>
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="HDFC Corporate Visa" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bank / Card Provider</Label>
              <Input value={newProvider} onChange={(e) => setNewProvider(e.target.value)} placeholder="HDFC Bank" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Last 4 digits</Label>
              <Input value={newLast4} onChange={(e) => setNewLast4(e.target.value)} placeholder="4821" maxLength={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newLabel.trim() || saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
