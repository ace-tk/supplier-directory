"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Paperclip, Camera, X, Check, ChevronsUpDown, Search, Save } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandInput } from "@/components/ui/command";
import { ExpenseNotesField } from "./ExpenseNotesField";
import { CategoryPicker } from "./CategoryPicker";
import { LocationField } from "./LocationField";
import {
  createExpenseAction,
  updateExpenseAction,
  getExpensePartyOptionsAction,
  getExpenseInvoiceOptionsAction,
} from "@/services/expenses";
import { cn } from "@/lib/utils";
import type { ExpenseRecord, ExpenseCategory, InvoiceOption } from "@/types/expense";
import type { DirectoryOption } from "@/types/invoicing";

interface FormState {
  date: string;
  time: string;
  location: string;
  locationLat: number | null;
  locationLng: number | null;
  category: ExpenseCategory;
  customCategoryId: string | null;
  customCategoryLabel: string;
  amount: string;
  currency: string;
  notes: string;
  partyUserId: string | null;
  partyLabel: string;
  relatedInvoiceId: string | null;
  relatedInvoiceLabel: string;
  attachmentFileName: string;
  attachmentUrl: string;
}

function formFromExpense(expense: ExpenseRecord | null): FormState {
  const occurred = expense ? new Date(expense.occurredAt) : new Date();
  return {
    date: occurred.toISOString().slice(0, 10),
    time: expense ? occurred.toISOString().slice(11, 16) : "",
    location: expense?.location ?? "",
    locationLat: expense?.locationLat ?? null,
    locationLng: expense?.locationLng ?? null,
    category: expense?.category ?? "MISCELLANEOUS",
    customCategoryId: expense?.customCategoryId ?? null,
    customCategoryLabel: expense?.customCategoryLabel ?? "",
    amount: expense?.amount ?? "0",
    currency: expense?.currency ?? "INR",
    notes: expense?.notes ?? "",
    partyUserId: expense?.partyUserId ?? null,
    partyLabel: expense?.partyName ?? "",
    relatedInvoiceId: expense?.relatedInvoiceId ?? null,
    relatedInvoiceLabel: expense?.relatedInvoiceNumber ?? "",
    attachmentFileName: expense?.attachmentFileName ?? "",
    attachmentUrl: expense?.attachmentUrl ?? "",
  };
}

/** Full-page Add/Edit Expense — a normal route rather than a dialog, so it
 * has room to grow (attachments, party/invoice linking) without feeling
 * cramped. Card-per-section layout, Save/Cancel always visible in the header. */
export function ExpenseForm({ basePath, expense }: { basePath: string; expense: ExpenseRecord | null }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => formFromExpense(expense));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [partyOptions, setPartyOptions] = useState<DirectoryOption[]>([]);
  const [partyOpen, setPartyOpen] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceOptions, setInvoiceOptions] = useState<InvoiceOption[]>([]);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  const expensesPath = `${basePath}/expenses`;

  function patch(p: Partial<FormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  useEffect(() => {
    getExpensePartyOptionsAction().then((r) => {
      if (r.success) setPartyOptions(r.data);
    });
  }, []);

  useEffect(() => {
    if (!invoiceOpen) return;
    const handle = setTimeout(() => {
      getExpenseInvoiceOptionsAction(invoiceSearch).then((r) => {
        if (r.success) setInvoiceOptions(r.data);
      });
    }, 200);
    return () => clearTimeout(handle);
  }, [invoiceSearch, invoiceOpen]);

  async function handleAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/supplier-portal/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Upload failed");
      patch({ attachmentFileName: data.name, attachmentUrl: data.url });
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!form.date) {
      toast.error("Date is required.");
      return;
    }
    setSaving(true);
    const payload = {
      occurredAt: new Date(`${form.date}T${form.time || "00:00"}`).toISOString(),
      location: form.location,
      locationLat: form.locationLat,
      locationLng: form.locationLng,
      category: form.category,
      customCategoryId: form.customCategoryId,
      customCategoryLabel: form.customCategoryLabel,
      amount: form.amount,
      currency: form.currency,
      notes: form.notes,
      partyUserId: form.partyUserId,
      relatedInvoiceId: form.relatedInvoiceId,
      attachmentFileName: form.attachmentFileName,
      attachmentUrl: form.attachmentUrl,
    };
    const result = expense ? await updateExpenseAction(expense.id, payload) : await createExpenseAction(payload);
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success(expense ? "Expense updated" : "Expense added");
    router.push(expensesPath);
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={expense ? "Edit Expense" : "Add Expense"}
        description="Operational costs — shipping, travel, samples, and more. Kept separate from invoice line items."
        breadcrumbs={[
          { label: "Invoice Management", href: basePath },
          { label: "Expenses", href: expensesPath },
          { label: expense ? "Edit" : "Add" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push(expensesPath)}>
              <ArrowLeft className="h-3.5 w-3.5" /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Expense
            </Button>
          </div>
        }
      />

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Details</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={form.date} onChange={(e) => patch({ date: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Time</Label>
            <Input type="time" value={form.time} onChange={(e) => patch({ time: e.target.value })} />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Category</Label>
            <CategoryPicker
              value={{ category: form.category, customCategoryId: form.customCategoryId, customCategoryLabel: form.customCategoryLabel }}
              onChange={(v) => patch({ category: v.category, customCategoryId: v.customCategoryId, customCategoryLabel: v.customCategoryLabel })}
            />
          </div>
          <LocationField
            value={{ location: form.location, locationLat: form.locationLat, locationLng: form.locationLng }}
            onChange={(v) => patch(v)}
          />
        </div>
        {form.category === "OTHER" && !form.customCategoryId && (
          <div className="space-y-1.5">
            <Label className="text-xs">Custom Category Label</Label>
            <Input value={form.customCategoryLabel} onChange={(e) => patch({ customCategoryLabel: e.target.value })} />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Amount</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Amount</Label>
            <Input type="number" min={0} value={form.amount} onChange={(e) => patch({ amount: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Currency</Label>
            <Input value={form.currency} onChange={(e) => patch({ currency: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Linked Records</h2>
        <div className="space-y-1.5">
          <Label className="text-xs">Buyer / Supplier</Label>
          <Popover open={partyOpen} onOpenChange={setPartyOpen}>
            <PopoverTrigger render={<Button variant="outline" className="w-full justify-between font-normal" />}>
              <span className="truncate">{form.partyLabel || "Optional — select a buyer or supplier"}</span>
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </PopoverTrigger>
            <PopoverContent className="w-[--anchor-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search buyers and suppliers..." />
                <CommandList>
                  <CommandEmpty>No matches found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="none"
                      onSelect={() => {
                        patch({ partyUserId: null, partyLabel: "" });
                        setPartyOpen(false);
                      }}
                    >
                      <Check className={cn("h-3.5 w-3.5", !form.partyUserId ? "opacity-100" : "opacity-0")} />
                      None
                    </CommandItem>
                    {partyOptions.map((opt) => (
                      <CommandItem
                        key={opt.id}
                        value={`${opt.companyName} ${opt.name}`}
                        onSelect={() => {
                          patch({ partyUserId: opt.id, partyLabel: opt.companyName || opt.name });
                          setPartyOpen(false);
                        }}
                      >
                        <Check className={cn("h-3.5 w-3.5", form.partyUserId === opt.id ? "opacity-100" : "opacity-0")} />
                        {opt.companyName || opt.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Related Sales / Purchase Invoice</Label>
          <Popover open={invoiceOpen} onOpenChange={setInvoiceOpen}>
            <PopoverTrigger render={<Button variant="outline" className="w-full justify-between font-normal" />}>
              <span className="flex items-center gap-2 truncate">
                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {form.relatedInvoiceLabel || "Optional — search by invoice number"}
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </PopoverTrigger>
            <PopoverContent className="w-[--anchor-width] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput placeholder="Type an invoice number..." value={invoiceSearch} onValueChange={setInvoiceSearch} />
                <CommandList>
                  <CommandEmpty>{invoiceSearch ? "No invoices found." : "Start typing to search."}</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="none"
                      onSelect={() => {
                        patch({ relatedInvoiceId: null, relatedInvoiceLabel: "" });
                        setInvoiceOpen(false);
                      }}
                    >
                      <Check className={cn("h-3.5 w-3.5", !form.relatedInvoiceId ? "opacity-100" : "opacity-0")} />
                      None
                    </CommandItem>
                    {invoiceOptions.map((opt) => (
                      <CommandItem
                        key={opt.id}
                        value={opt.invoiceNumber}
                        onSelect={() => {
                          patch({ relatedInvoiceId: opt.id, relatedInvoiceLabel: opt.invoiceNumber });
                          setInvoiceOpen(false);
                        }}
                      >
                        <Check className={cn("h-3.5 w-3.5", form.relatedInvoiceId === opt.id ? "opacity-100" : "opacity-0")} />
                        <span className="font-mono text-xs">{opt.invoiceNumber}</span>
                        <span className="text-muted-foreground ml-1.5">{opt.partyName}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Notes</h2>
        <ExpenseNotesField value={form.notes} onChange={(v) => patch({ notes: v })} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Attachment</h2>
        {form.attachmentFileName ? (
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-foreground truncate flex-1">{form.attachmentFileName}</span>
            <button type="button" onClick={() => patch({ attachmentFileName: "", attachmentUrl: "" })} aria-label="Remove attachment">
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-2 rounded-lg border-2 border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors cursor-pointer w-fit">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
              {uploading ? "Uploading..." : "Attach File"}
              <input type="file" className="hidden" onChange={handleAttachment} disabled={uploading} />
            </label>
            <label className="flex items-center gap-2 rounded-lg border-2 border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors cursor-pointer w-fit">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              {uploading ? "Uploading..." : "Scan"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleAttachment}
                disabled={uploading}
              />
            </label>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pb-6">
        <Button variant="outline" onClick={() => router.push(expensesPath)}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {expense ? "Save Changes" : "Add Expense"}
        </Button>
      </div>
    </div>
  );
}
