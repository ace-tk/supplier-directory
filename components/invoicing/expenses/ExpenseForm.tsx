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
  Eye,
  Save,
  Copy,
  Eraser,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { PartyLinkCard } from "./PartyLinkCard";
import { ManualPartyFields } from "./ManualPartyFields";
import { ContactPicker } from "./ContactPicker";
import { PaymentAccountPicker } from "./PaymentAccountPicker";
import { VoucherSection } from "./VoucherSection";
import {
  createExpenseAction,
  updateExpenseAction,
  listExpensesAction,
  listExpenseCustomCategoriesAction,
  createExpenseContactAction,
} from "@/services/expenses";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_OPTIONS } from "@/lib/expenses/ui";
import { getCategoryColor } from "@/lib/expenses/category-colors";
import { GST_RATE_OPTIONS } from "@/lib/catalog-ui";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from "@/lib/invoicing/ui";
import { cn } from "@/lib/utils";
import type { ExpenseRecord, ExpenseCategory, PaymentMethod, ExpenseCustomCategoryOption } from "@/types/expense";
import type { InvoiceTemplate } from "@/types/invoicing";

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

  buyerUserId: string | null;
  buyerLabel: string;
  relatedInvoiceId: string | null;
  relatedInvoiceLabel: string;

  supplierUserId: string | null;
  supplierLabel: string;
  relatedPurchaseInvoiceId: string | null;
  relatedPurchaseInvoiceLabel: string;

  manualPartyName: string;

  contactId: string | null;
  contactLabel: string;
  manualContactName: string;
  manualContactPhone: string;
  manualContactCountryCode: string;
  saveToContacts: boolean;

  paymentAccountId: string | null;
  paymentAccountLabel: string;
  paymentAccountProvider: string;
  referenceNumber: string;

  createVoucher: boolean;
  voucherTemplate: InvoiceTemplate | null;

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

    buyerUserId: expense?.buyerUserId ?? null,
    buyerLabel: expense?.buyerName ?? "",
    relatedInvoiceId: expense?.relatedInvoiceId ?? null,
    relatedInvoiceLabel: expense?.relatedInvoiceNumber ?? "",

    supplierUserId: expense?.supplierUserId ?? null,
    supplierLabel: expense?.supplierName ?? "",
    relatedPurchaseInvoiceId: expense?.relatedPurchaseInvoiceId ?? null,
    relatedPurchaseInvoiceLabel: expense?.relatedPurchaseInvoiceNumber ?? "",

    manualPartyName: expense?.manualPartyName ?? "",

    contactId: expense?.contactId ?? null,
    contactLabel: expense?.contactName ?? "",
    manualContactName: expense?.manualContactName ?? "",
    manualContactPhone: expense?.manualContactPhone ?? "",
    manualContactCountryCode: expense?.manualContactCountryCode ?? "+91",
    saveToContacts: false,

    paymentAccountId: expense?.paymentAccountId ?? null,
    paymentAccountLabel: expense?.paymentAccountLabel ?? "",
    paymentAccountProvider: expense?.paymentAccountProvider ?? "",
    referenceNumber: expense?.referenceNumber ?? "",

    createVoucher: expense?.createVoucher ?? false,
    voucherTemplate: expense?.voucherTemplate ?? null,

    attachmentFileName: expense?.attachmentFileName ?? "",
    attachmentUrl: expense?.attachmentUrl ?? "",
  };
}

function isBlank(form: FormState): boolean {
  return (
    form.amount === "0" &&
    !form.location &&
    !form.notes &&
    !form.buyerUserId &&
    !form.supplierUserId &&
    !form.manualPartyName &&
    !form.relatedInvoiceId &&
    !form.relatedPurchaseInvoiceId &&
    !form.attachmentFileName &&
    !form.gstNumber &&
    !form.department &&
    !form.expenseType
  );
}

/** Full-page Add/Edit Expense — a normal route rather than a dialog. */
export function ExpenseForm({ basePath, expense, ownerName }: { basePath: string; expense: ExpenseRecord | null; ownerName: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState<FormState>(() => formFromExpense(expense));
  const [saving, setSaving] = useState<"save" | "duplicate" | null>(null);
  const [uploading, setUploading] = useState(false);
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

  /** Best-effort convenience: prefills GST from the linked document's
   * partyTaxId only when the user hasn't already typed one in — never
   * overwrites a value they entered. */
  function applyDocumentLink(fields: Partial<FormState>, partyTaxId?: string | null) {
    setForm((f) => ({
      ...f,
      ...fields,
      gstNumber: partyTaxId && !f.gstNumber ? partyTaxId : f.gstNumber,
    }));
  }

  useEffect(() => {
    listExpenseCustomCategoriesAction().then((r) => {
      if (r.success) setCustomCategories(r.data);
    });
    listExpensesAction({}).then((r) => {
      if (r.success) setRecentExpenses(r.data);
    });
  }, []);

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

  function buildPayload(contactIdOverride?: string | null) {
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
      buyerUserId: form.buyerUserId,
      relatedInvoiceId: form.relatedInvoiceId,
      supplierUserId: form.supplierUserId,
      relatedPurchaseInvoiceId: form.relatedPurchaseInvoiceId,
      manualPartyName: form.buyerUserId || form.supplierUserId ? "" : form.manualPartyName,
      contactId: contactIdOverride !== undefined ? contactIdOverride : form.contactId,
      manualContactName: form.manualContactName,
      manualContactPhone: form.manualContactPhone,
      manualContactCountryCode: form.manualContactCountryCode,
      paymentAccountId: form.paymentAccountId,
      referenceNumber: form.referenceNumber,
      createVoucher: form.createVoucher,
      voucherTemplate: form.voucherTemplate,
      attachmentFileName: form.attachmentFileName,
      attachmentUrl: form.attachmentUrl,
    };
  }

  async function handleSave() {
    if (!form.date) return toast.error("Date is required.");
    if (!form.amount || Number(form.amount) <= 0) return toast.error("Amount is required.");
    if (!form.paymentMethod) return toast.error("Transaction Type is required.");
    if (form.paymentMethod !== "CASH" && !form.paymentAccountId) return toast.error("Please select or add a Paid By account.");

    setSaving("save");

    // Only ever persists a new contact when the user explicitly opted in —
    // never auto-created as a side effect of saving the expense.
    let contactId = form.contactId;
    if (!contactId && form.saveToContacts && form.manualContactName.trim()) {
      const contactResult = await createExpenseContactAction({
        partyUserId: form.buyerUserId || form.supplierUserId || null,
        name: form.manualContactName,
        phone: form.manualContactPhone,
        countryCode: form.manualContactCountryCode,
      });
      if (contactResult.success) contactId = contactResult.data.id;
    }

    const result = expense
      ? await updateExpenseAction(expense.id, buildPayload(contactId))
      : await createExpenseAction(buildPayload(contactId));
    setSaving(null);
    if (!result.success) return toast.error(result.error);
    toast.success(expense ? "Expense updated" : "Expense added");
    router.push(expensesPath);
  }

  async function handleDuplicate() {
    if (!expense) return;
    setSaving("duplicate");
    const result = await createExpenseAction(buildPayload());
    setSaving(null);
    if (!result.success) return toast.error(result.error);
    toast.success("Expense duplicated");
    router.push(`${expensesPath}/${result.data.id}/edit`);
  }

  function handleClearForm() {
    if (isBlank(form)) {
      setForm(formFromExpense(null));
      return;
    }
    setClearConfirmOpen(true);
  }

  const hasGst = Boolean(form.gstNumber.trim() || form.gstPercent);
  const noPartyLinked = !form.buyerUserId && !form.supplierUserId;

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
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Date *</Label>
                <Input type="date" value={form.date} onChange={(e) => patch({ date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Time</Label>
                <Input type="time" value={form.time} onChange={(e) => patch({ time: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Amount *</Label>
                <div className="flex gap-1.5">
                  <Select value={form.currency} onValueChange={(v) => v && patch({ currency: v })}>
                    <SelectTrigger className="w-20 shrink-0">
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
                  <Input type="number" min={0} value={form.amount} onChange={(e) => patch({ amount: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Transaction Type *</Label>
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_METHOD_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => patch({ paymentMethod: m, ...(m === "CASH" ? { paymentAccountId: null, paymentAccountLabel: "", paymentAccountProvider: "", referenceNumber: "" } : {}) })}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                      form.paymentMethod === m ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    {PAYMENT_METHOD_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <PartyLinkCard
                role="BUYER"
                partyUserId={form.buyerUserId}
                partyLabel={form.buyerLabel}
                documentId={form.relatedInvoiceId}
                onPartyChange={(id, label) => patch({ buyerUserId: id, buyerLabel: label })}
                onDocumentChange={(id, label, partyTaxId) => applyDocumentLink({ relatedInvoiceId: id, relatedInvoiceLabel: label }, partyTaxId)}
              />
              <PartyLinkCard
                role="SUPPLIER"
                partyUserId={form.supplierUserId}
                partyLabel={form.supplierLabel}
                documentId={form.relatedPurchaseInvoiceId}
                onPartyChange={(id, label) => patch({ supplierUserId: id, supplierLabel: label })}
                onDocumentChange={(id, label, partyTaxId) =>
                  applyDocumentLink({ relatedPurchaseInvoiceId: id, relatedPurchaseInvoiceLabel: label }, partyTaxId)
                }
              />
            </div>

            {noPartyLinked && (
              <ManualPartyFields value={form.manualPartyName} onChange={(v) => patch({ manualPartyName: v })} />
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Category *</Label>
              <CategoryPicker
                value={{ category: form.category, customCategoryId: form.customCategoryId, customCategoryLabel: form.customCategoryLabel }}
                onChange={(v) => patch({ category: v.category, customCategoryId: v.customCategoryId, customCategoryLabel: v.customCategoryLabel })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Quick Categories</Label>
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

            <PaymentAccountPicker
              paymentMethod={form.paymentMethod}
              paymentAccountId={form.paymentAccountId}
              paymentAccountLabel={form.paymentAccountLabel}
              paymentAccountProvider={form.paymentAccountProvider}
              referenceNumber={form.referenceNumber}
              onAccountChange={(id, label, provider) => patch({ paymentAccountId: id, paymentAccountLabel: label, paymentAccountProvider: provider })}
              onReferenceChange={(v) => patch({ referenceNumber: v })}
            />

            <ContactPicker
              partyUserId={form.buyerUserId || form.supplierUserId}
              value={{
                contactId: form.contactId,
                contactLabel: form.contactLabel,
                manualContactName: form.manualContactName,
                manualContactPhone: form.manualContactPhone,
                manualContactCountryCode: form.manualContactCountryCode,
                saveToContacts: form.saveToContacts,
              }}
              onChange={(patchValue) => patch(patchValue)}
            />

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

            <VoucherSection
              createVoucher={form.createVoucher}
              voucherTemplate={form.voucherTemplate}
              onChange={(v) => patch(v)}
              previewInput={{
                ownerName,
                occurredAt: form.date,
                amount: form.amount,
                currency: form.currency,
                category: form.category,
                customCategoryLabel: form.customCategoryLabel,
                partyLabel: form.buyerLabel || form.supplierLabel || form.manualPartyName,
                gstNumber: form.gstNumber,
                gstPercent: form.gstPercent,
                notes: form.notes,
                referenceNumber: form.referenceNumber,
                isSupplierLinked: Boolean(form.supplierUserId),
              }}
            />
          </SectionCard>

          <SectionCard number={2} title="Additional Details">
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

          <SectionCard number={3} title="Notes">
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

          <SmartTipsCard hasInvoice={!!form.relatedInvoiceId || !!form.relatedPurchaseInvoiceId} hasGst={hasGst} hasAttachment={!!form.attachmentFileName} />
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
