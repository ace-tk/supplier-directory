"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Paperclip,
  Camera,
  X,
  Check,
  ChevronsUpDown,
  Search,
  Save,
  Copy,
  Eraser,
  Eye,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandInput } from "@/components/ui/command";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ExpenseNotesField } from "./ExpenseNotesField";
import { CategoryPicker } from "./CategoryPicker";
import { LocationField } from "./LocationField";
import { ExpenseSummaryStrip } from "./ExpenseSummaryStrip";
import { ExpenseCalendar } from "./ExpenseCalendar";
import { RecentExpensesPanel } from "./RecentExpensesPanel";
import { ReceiptPreviewPanel } from "./ReceiptPreviewPanel";
import { SmartTipsCard } from "./SmartTipsCard";
import {
  createExpenseAction,
  updateExpenseAction,
  getExpensePartyOptionsAction,
  getExpenseInvoiceOptionsAction,
  listExpensesAction,
  listExpenseCustomCategoriesAction,
} from "@/services/expenses";
import { getCategoryColor } from "@/lib/expenses/category-colors";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_OPTIONS } from "@/lib/expenses/ui";
import { GST_RATE_OPTIONS } from "@/lib/catalog-ui";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from "@/lib/invoicing/ui";
import { cn } from "@/lib/utils";
import type { ExpenseRecord, ExpenseCategory, InvoiceOption, PaymentMethod, ExpenseCustomCategoryOption } from "@/types/expense";
import type { DirectoryOption } from "@/types/invoicing";

const CURRENCY_OPTIONS = ["INR", "USD", "EUR", "GBP"];

interface FormState {
  date: string;
  time: string;
  location: string;
  locationLat: number | null;
  locationLng: number | null;
  category: ExpenseCategory;
  customCategoryId: string | null;
  customCategoryLabel: string;
  gstNumber: string;
  gstPercent: number | null;
  amount: string;
  currency: string;
  paymentMethod: PaymentMethod | null;
  department: string;
  expenseType: string;
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
    gstNumber: expense?.gstNumber ?? "",
    gstPercent: expense?.gstPercent ?? null,
    amount: expense?.amount ?? "0",
    currency: expense?.currency ?? "INR",
    paymentMethod: expense?.paymentMethod ?? null,
    department: expense?.department ?? "",
    expenseType: expense?.expenseType ?? "",
    notes: expense?.notes ?? "",
    partyUserId: expense?.partyUserId ?? null,
    partyLabel: expense?.partyName ?? "",
    relatedInvoiceId: expense?.relatedInvoiceId ?? null,
    relatedInvoiceLabel: expense?.relatedInvoiceNumber ?? "",
    attachmentFileName: expense?.attachmentFileName ?? "",
    attachmentUrl: expense?.attachmentUrl ?? "",
  };
}

function isBlank(form: FormState): boolean {
  return (
    form.amount === "0" &&
    !form.location &&
    !form.notes &&
    !form.partyUserId &&
    !form.relatedInvoiceId &&
    !form.attachmentFileName &&
    !form.gstNumber &&
    !form.department &&
    !form.expenseType
  );
}

/** Full-page Add/Edit Expense — a normal route rather than a dialog. */
export function ExpenseForm({ basePath, expense }: { basePath: string; expense: ExpenseRecord | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState<FormState>(() => formFromExpense(expense));
  const [saving, setSaving] = useState<"save" | "duplicate" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [partyOptions, setPartyOptions] = useState<DirectoryOption[]>([]);
  const [partyOpen, setPartyOpen] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceOptions, setInvoiceOptions] = useState<InvoiceOption[]>([]);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [customCategories, setCustomCategories] = useState<ExpenseCustomCategoryOption[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<ExpenseRecord[] | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const expensesPath = `${basePath}/expenses`;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const attachmentSectionRef = useRef<HTMLDivElement>(null);

  function patch(p: Partial<FormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  useEffect(() => {
    getExpensePartyOptionsAction().then((r) => {
      if (r.success) setPartyOptions(r.data);
    });
    listExpenseCustomCategoriesAction().then((r) => {
      if (r.success) setCustomCategories(r.data);
    });
    listExpensesAction({}).then((r) => {
      if (r.success) setRecentExpenses(r.data);
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

  // Deep-link from the Overview's "Upload Bill" quick action — opens the
  // real upload picker directly instead of just landing on a blank page.
  useEffect(() => {
    if (searchParams.get("attach") !== "1") return;
    attachmentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    fileInputRef.current?.click();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const expenseDates = useMemo(() => {
    const set = new Set<string>();
    for (const e of recentExpenses ?? []) set.add(e.occurredAt.slice(0, 10));
    return set;
  }, [recentExpenses]);

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

  function buildPayload() {
    return {
      occurredAt: new Date(`${form.date}T${form.time || "00:00"}`).toISOString(),
      location: form.location,
      locationLat: form.locationLat,
      locationLng: form.locationLng,
      category: form.category,
      customCategoryId: form.customCategoryId,
      customCategoryLabel: form.customCategoryLabel,
      gstNumber: form.gstNumber,
      gstPercent: form.gstPercent,
      amount: form.amount,
      currency: form.currency,
      paymentMethod: form.paymentMethod,
      department: form.department,
      expenseType: form.expenseType,
      notes: form.notes,
      partyUserId: form.partyUserId,
      relatedInvoiceId: form.relatedInvoiceId,
      attachmentFileName: form.attachmentFileName,
      attachmentUrl: form.attachmentUrl,
    };
  }

  async function handleSave() {
    if (!form.date) {
      toast.error("Date is required.");
      return;
    }
    setSaving("save");
    const result = expense ? await updateExpenseAction(expense.id, buildPayload()) : await createExpenseAction(buildPayload());
    setSaving(null);
    if (!result.success) return toast.error(result.error);
    toast.success(expense ? "Expense updated" : "Expense added");
    router.push(expensesPath);
    router.refresh();
  }

  async function handleDuplicate() {
    if (!expense) return;
    setSaving("duplicate");
    const result = await createExpenseAction(buildPayload());
    setSaving(null);
    if (!result.success) return toast.error(result.error);
    toast.success("Expense duplicated");
    router.push(`${expensesPath}/${result.data.id}/edit`);
    router.refresh();
  }

  function handleClearForm() {
    if (isBlank(form)) {
      setForm(formFromExpense(null));
      return;
    }
    setClearConfirmOpen(true);
  }

  const hasGst = Boolean(form.gstNumber.trim() || form.gstPercent);

  return (
    <div className="space-y-4">
      <PageHeader
        title={expense ? "Edit Expense" : "Add Expense"}
        description="Track every business expense and stay on top of your finances."
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
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />} Attach Receipt
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving !== null} className="gap-1.5">
              {saving === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Expense
            </Button>
          </div>
        }
      />

      <ExpenseSummaryStrip
        amount={form.amount}
        currency={form.currency}
        date={form.date}
        category={form.category}
        customCategoryLabel={form.customCategoryLabel}
      />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        {/* Left / main workspace (~65-70%) */}
        <div className="space-y-4 min-w-0">
          <SectionCard number={1} title="Basic Details">
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
              <div className="space-y-1.5">
                <Label className="text-xs">Company / Person</Label>
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
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Quick Category</Label>
              <div className="flex flex-wrap gap-1.5">
                {EXPENSE_CATEGORY_OPTIONS.filter((c) => c !== "OTHER").map((c) => {
                  const color = getCategoryColor({ category: c });
                  const active = form.category === c && !form.customCategoryId;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => patch({ category: c, customCategoryId: null, customCategoryLabel: "" })}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                        active ? `${color.bg} ${color.text} border-transparent` : "border-border text-muted-foreground hover:border-primary/40"
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", color.dot)} />
                      {EXPENSE_CATEGORY_LABELS[c]}
                    </button>
                  );
                })}
                {customCategories.map((c) => {
                  const color = getCategoryColor({ category: "OTHER", customCategoryId: c.id });
                  const active = form.customCategoryId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => patch({ category: "OTHER", customCategoryId: c.id, customCategoryLabel: c.name })}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                        active ? `${color.bg} ${color.text} border-transparent` : "border-border text-muted-foreground hover:border-primary/40"
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", color.dot)} />
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {form.category === "OTHER" && !form.customCategoryId && (
              <div className="space-y-1.5">
                <Label className="text-xs">Custom Category Label</Label>
                <Input value={form.customCategoryLabel} onChange={(e) => patch({ customCategoryLabel: e.target.value })} />
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">GST Number</Label>
                <Input value={form.gstNumber} onChange={(e) => patch({ gstNumber: e.target.value })} placeholder="Optional" />
              </div>
              <LocationField
                value={{ location: form.location, locationLat: form.locationLat, locationLng: form.locationLng }}
                onChange={(v) => patch(v)}
              />
            </div>
          </SectionCard>

          <Accordion multiple defaultValue={["amount"]}>
            <AccordionItem value="amount">
              <AccordionTrigger>
                <span className="text-sm font-semibold text-foreground">2. Amount Details</span>
              </AccordionTrigger>
                <AccordionPanel className="space-y-4">
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Amount</Label>
                      <Input type="number" min={0} value={form.amount} onChange={(e) => patch({ amount: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Currency</Label>
                      <Select value={form.currency} onValueChange={(v) => v && patch({ currency: v })}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCY_OPTIONS.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Payment Method</Label>
                      <Select
                        value={form.paymentMethod ?? "__none__"}
                        onValueChange={(v) => v && patch({ paymentMethod: v === "__none__" ? null : (v as PaymentMethod) })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Not specified</SelectItem>
                          {PAYMENT_METHOD_OPTIONS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {PAYMENT_METHOD_LABELS[m]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                    Link this expense to an invoice or deal to keep your records organized.
                  </p>
                </AccordionPanel>
            </AccordionItem>
          </Accordion>

          <SectionCard number={3} title="Link Records (Optional)">
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
          </SectionCard>

          <SectionCard number={4} title="Additional Details">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Department / Team</Label>
                <Input value={form.department} onChange={(e) => patch({ department: e.target.value })} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Expense Type</Label>
                <Input value={form.expenseType} onChange={(e) => patch({ expenseType: e.target.value })} placeholder="Optional" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tax / GST</Label>
              <div className="flex flex-wrap gap-1.5">
                {GST_RATE_OPTIONS.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => patch({ gstPercent: form.gstPercent === rate ? null : rate })}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                      form.gstPercent === rate
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    GST {rate}%
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard number={5} title="Notes">
            <ExpenseNotesField value={form.notes} onChange={(v) => patch({ notes: v })} />
          </SectionCard>

          <div ref={attachmentSectionRef}>
            <SectionCard title="Attached Receipt">
              {form.attachmentFileName ? (
                <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground truncate flex-1">{form.attachmentFileName}</span>
                  <a
                    href={form.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
                  >
                    <Eye className="h-3.5 w-3.5" /> View
                  </a>
                  <button type="button" onClick={() => patch({ attachmentFileName: "", attachmentUrl: "" })} aria-label="Remove attachment">
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="flex items-center gap-2 rounded-lg border-2 border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors cursor-pointer w-fit">
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                    {uploading ? "Uploading..." : "Attach File"}
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleAttachment} disabled={uploading} />
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border-2 border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors cursor-pointer w-fit">
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                    {uploading ? "Uploading..." : "Scan"}
                    <input
                      ref={scanInputRef}
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
            </SectionCard>
          </div>
        </div>

        {/* Right context panel (~30-35%) */}
        <div className="space-y-4">
          <ReceiptPreviewPanel
            fileName={form.attachmentFileName || null}
            url={form.attachmentUrl || null}
            onRemove={() => patch({ attachmentFileName: "", attachmentUrl: "" })}
          />

          <div className="rounded-2xl border border-border bg-card p-4">
            <ExpenseCalendar selectedDate={form.date} onSelectDate={(d) => patch({ date: d })} expenseDates={expenseDates} />
          </div>

          <RecentExpensesPanel basePath={basePath} expenses={recentExpenses ? recentExpenses.slice(0, 5) : null} />

          <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <h3 className="text-xs font-semibold text-foreground">Quick Actions</h3>
            <div className="space-y-1.5">
              {expense && (
                <Button variant="outline" size="sm" className="w-full gap-1.5 justify-start" onClick={handleDuplicate} disabled={saving !== null}>
                  {saving === "duplicate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />} Duplicate Expense
                </Button>
              )}
              <Button variant="outline" size="sm" className="w-full gap-1.5 justify-start" onClick={handleClearForm}>
                <Eraser className="h-3.5 w-3.5" /> Clear Form
              </Button>
            </div>
          </div>

          <SmartTipsCard hasInvoice={!!form.relatedInvoiceId} hasGst={hasGst} hasAttachment={!!form.attachmentFileName} />
        </div>
      </div>

      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this form?</AlertDialogTitle>
            <AlertDialogDescription>Everything you&apos;ve entered will be lost. This can&apos;t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setForm(formFromExpense(null));
                setClearConfirmOpen(false);
              }}
            >
              Clear Form
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SectionCard({ number, title, children }: { number?: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">
        {number ? `${number}. ${title}` : title}
      </h2>
      {children}
    </div>
  );
}
