"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getPartyOptionsAction } from "@/services/invoicing";
import { invoiceFamily } from "@/lib/invoicing/family";
import type { EditorFormState } from "./types";
import type { DirectoryOption } from "@/types/invoicing";

export function PartyPicker({
  form,
  onChange,
}: {
  form: EditorFormState;
  onChange: (patch: Partial<EditorFormState>) => void;
}) {
  const [options, setOptions] = useState<DirectoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPartyOptionsAction(form.type).then((result) => {
      if (cancelled) return;
      if (result.success) setOptions(result.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [form.type]);

  const roleLabel = invoiceFamily(form.type) === "SALES" ? "Buyer / Customer" : "Supplier / Vendor";

  function selectOption(opt: DirectoryOption) {
    onChange({
      counterpartyUserId: opt.id,
      partyName: opt.companyName || opt.name,
      partyContactPerson: opt.name,
      partyEmail: opt.email,
    });
    setOpen(false);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{roleLabel}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select a registered {roleLabel.toLowerCase()} to autofill their details, or type them in manually below.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Search {roleLabel}</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button variant="outline" className="w-full justify-between font-normal" />
            }
          >
            <span className="flex items-center gap-2 truncate">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {form.counterpartyUserId
                ? options.find((o) => o.id === form.counterpartyUserId)?.companyName || form.partyName
                : loading
                  ? "Loading…"
                  : `Select a ${roleLabel.toLowerCase()}`}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </PopoverTrigger>
          <PopoverContent className="w-[--anchor-width] p-0" align="start">
            <Command>
              <CommandInput placeholder={`Search ${roleLabel.toLowerCase()}s...`} />
              <CommandList>
                <CommandEmpty>No {roleLabel.toLowerCase()}s found.</CommandEmpty>
                <CommandGroup>
                  {options.map((opt) => (
                    <CommandItem key={opt.id} value={`${opt.companyName} ${opt.name}`} onSelect={() => selectOption(opt)}>
                      <Check
                        className={cn("h-3.5 w-3.5", form.counterpartyUserId === opt.id ? "opacity-100" : "opacity-0")}
                      />
                      <span className="flex flex-col">
                        <span className="text-foreground">{opt.companyName || opt.name}</span>
                        {opt.companyName && <span className="text-xs text-muted-foreground">{opt.name}</span>}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Company Name</Label>
          <Input value={form.partyName} onChange={(e) => onChange({ partyName: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Contact Person</Label>
          <Input
            value={form.partyContactPerson}
            onChange={(e) => onChange({ partyContactPerson: e.target.value })}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Email</Label>
          <Input type="email" value={form.partyEmail} onChange={(e) => onChange({ partyEmail: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Phone</Label>
          <Input
            value={form.partyPhone}
            onChange={(e) => onChange({ partyPhone: e.target.value })}
            placeholder="Not on file — enter for this invoice"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Billing Address</Label>
          <Textarea
            rows={2}
            value={form.partyBillingAddress}
            onChange={(e) => onChange({ partyBillingAddress: e.target.value })}
            placeholder="Not on file — enter for this invoice"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Shipping Address</Label>
          <Textarea
            rows={2}
            value={form.partyShippingAddress}
            onChange={(e) => onChange({ partyShippingAddress: e.target.value })}
            placeholder="Same as billing, or enter separately"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">GSTIN / Tax ID</Label>
        <Input
          value={form.partyTaxId}
          onChange={(e) => onChange({ partyTaxId: e.target.value })}
          placeholder="Not on file — enter for this invoice"
        />
      </div>
    </div>
  );
}
