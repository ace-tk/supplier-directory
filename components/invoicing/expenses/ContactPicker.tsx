"use client";

import { useEffect, useState } from "react";
import { Check, User } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { listExpenseContactsAction } from "@/services/expenses";
import type { ExpenseContactOption } from "@/types/expense";

const COUNTRY_CODES = ["+91", "+1", "+44", "+971", "+65", "+61", "+49", "+81"];

export interface ContactFieldsValue {
  contactId: string | null;
  contactLabel: string;
  manualContactName: string;
  manualContactPhone: string;
  manualContactCountryCode: string;
  saveToContacts: boolean;
}

export function ContactPicker({
  partyUserId,
  value,
  onChange,
}: {
  partyUserId: string | null;
  value: ContactFieldsValue;
  onChange: (patch: Partial<ContactFieldsValue>) => void;
}) {
  const [tab, setTab] = useState<"saved" | "manual">(value.contactId ? "saved" : "manual");
  const [contacts, setContacts] = useState<ExpenseContactOption[] | null>(null);

  // Adjusted during render (not in an effect) so switching Buyer/Supplier
  // never briefly shows the previous party's contacts.
  const [prevPartyUserId, setPrevPartyUserId] = useState(partyUserId);
  if (partyUserId !== prevPartyUserId) {
    setPrevPartyUserId(partyUserId);
    setContacts(null);
  }

  useEffect(() => {
    let cancelled = false;
    listExpenseContactsAction(partyUserId).then((r) => {
      if (!cancelled && r.success) setContacts(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [partyUserId]);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Contact Person</Label>
      <Tabs value={tab} onValueChange={(v) => v && setTab(v as "saved" | "manual")}>
        <TabsList variant="line">
          <TabsTrigger value="saved">Person in Contact List</TabsTrigger>
          <TabsTrigger value="manual">Person Not in Contact List</TabsTrigger>
        </TabsList>

        <TabsContent value="saved" className="pt-2">
          {contacts === null ? (
            <p className="text-[11px] text-muted-foreground">Loading…</p>
          ) : contacts.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No contacts found{partyUserId ? " for this party" : ""}.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {contacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    onChange({
                      contactId: value.contactId === c.id ? null : c.id,
                      contactLabel: value.contactId === c.id ? "" : c.name,
                      manualContactName: "",
                      manualContactPhone: "",
                    })
                  }
                  className={cn(
                    "w-full flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                    value.contactId === c.id ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-foreground truncate">{c.name}</span>
                      <span className="block text-[11px] text-muted-foreground truncate">
                        {[c.email, c.phone ? `${c.countryCode ?? ""} ${c.phone}` : null].filter(Boolean).join(" · ") || "No contact details"}
                      </span>
                    </span>
                  </span>
                  {value.contactId === c.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="manual" className="pt-2 space-y-2">
          <div className="grid grid-cols-[90px_1fr] gap-2">
            <Select
              value={value.manualContactCountryCode || "+91"}
              onValueChange={(v) => v && onChange({ manualContactCountryCode: v, contactId: null, contactLabel: "" })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_CODES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={value.manualContactPhone}
              onChange={(e) => onChange({ manualContactPhone: e.target.value, contactId: null, contactLabel: "" })}
              placeholder="Mobile number"
            />
          </div>
          <Input
            value={value.manualContactName}
            onChange={(e) => onChange({ manualContactName: e.target.value, contactId: null, contactLabel: "" })}
            placeholder="Name"
          />
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={value.saveToContacts}
              onChange={(e) => onChange({ saveToContacts: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-input accent-primary"
            />
            Save this person to contacts
          </label>
        </TabsContent>
      </Tabs>
    </div>
  );
}
