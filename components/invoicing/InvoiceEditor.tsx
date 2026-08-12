"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Send } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InvoiceHeaderFields } from "./editor/InvoiceHeaderFields";
import { SellerInfoFields } from "./editor/SellerInfoFields";
import { PartyPicker } from "./editor/PartyPicker";
import { ItemTable } from "./editor/ItemTable";
import { ChargesAndNotesFields } from "./editor/ChargesAndNotesFields";
import { BankingDetailsFields } from "./editor/BankingDetailsFields";
import { TemplateSelector } from "./editor/TemplateSelector";
import { ReasonField } from "./editor/ReasonField";
import { TotalsSummary } from "./editor/TotalsSummary";
import { InvoiceTemplateRenderer } from "./templates/InvoiceTemplateRenderer";
import { calculateInvoiceTotals } from "@/lib/invoicing/calc";
import { invoiceFamily, DEPENDENT_TYPES } from "@/lib/invoicing/family";
import { nonDraftInitialStatus } from "@/lib/invoicing/status";
import { resolveLegacyShipping, resolveLegacyAdditionalCharges } from "@/lib/invoicing/charges";
import { INVOICE_TYPE_LABELS } from "@/lib/invoicing/ui";
import {
  createInvoiceAction,
  updateInvoiceAction,
  previewNextInvoiceNumberAction,
  getSellerDefaultsAction,
} from "@/services/invoicing";
import { emptyItem, newItemKey, todayISODate, addDaysISODate, type EditorFormState } from "./editor/types";
import type { InvoiceRecord, InvoiceType, InvoiceStatus } from "@/types/invoicing";

function defaultForm(type: InvoiceType): EditorFormState {
  return {
    type,
    invoiceNumber: "",
    status: "DRAFT",
    invoiceDate: todayISODate(),
    dueDate: addDaysISODate(15),
    currency: "INR",
    paymentTerms: "",
    referenceNumber: "",
    sellerName: "",
    sellerAddress: "",
    sellerTaxId: "",
    sellerPhone: "",
    sellerEmail: "",
    sellerLogoUrl: "",
    counterpartyUserId: null,
    partyName: "",
    partyContactPerson: "",
    partyEmail: "",
    partyPhone: "",
    partyBillingAddress: "",
    partyShippingAddress: "",
    partyTaxId: "",
    taxMode: "EXCLUSIVE",
    taxBreakup: "SINGLE",
    items: [emptyItem()],
    shippingType: "FIXED",
    shippingValue: "0",
    additionalCharges: [],
    additionalDiscount: "0",
    customerNotes: "",
    termsAndConditions: "",
    bankAccountHolder: "",
    bankName: "",
    bankAccountNumber: "",
    bankIfscCode: "",
    bankBranch: "",
    bankUpiId: "",
    bankPaymentInstructions: "",
    template: "REGULAR",
    reason: "",
  };
}

function formFromRecord(record: InvoiceRecord): EditorFormState {
  return {
    type: record.type,
    invoiceNumber: record.invoiceNumber,
    status: record.status,
    invoiceDate: record.invoiceDate.slice(0, 10),
    dueDate: record.dueDate.slice(0, 10),
    currency: record.currency,
    paymentTerms: record.paymentTerms ?? "",
    referenceNumber: record.referenceNumber ?? "",
    sellerName: record.sellerName,
    sellerAddress: record.sellerAddress ?? "",
    sellerTaxId: record.sellerTaxId ?? "",
    sellerPhone: record.sellerPhone ?? "",
    sellerEmail: record.sellerEmail ?? "",
    sellerLogoUrl: record.sellerLogoUrl ?? "",
    counterpartyUserId: record.counterpartyUserId,
    partyName: record.partyName,
    partyContactPerson: record.partyContactPerson ?? "",
    partyEmail: record.partyEmail ?? "",
    partyPhone: record.partyPhone ?? "",
    partyBillingAddress: record.partyBillingAddress ?? "",
    partyShippingAddress: record.partyShippingAddress ?? "",
    partyTaxId: record.partyTaxId ?? "",
    taxMode: record.taxMode,
    taxBreakup: record.taxBreakup,
    items:
      record.items.length > 0
        ? record.items.map((it) => ({
            key: it.id,
            catalogRowId: it.catalogRowId,
            productName: it.productName,
            description: it.description ?? "",
            hsnSac: it.hsnSac ?? "",
            quantity: it.quantity,
            unit: it.unit,
            rate: it.rate,
            discountPercent: it.discountPercent,
            taxPercent: it.taxPercent,
          }))
        : [emptyItem()],
    ...resolveLegacyShipping(record),
    additionalCharges: resolveLegacyAdditionalCharges(record).map((c) => ({
      key: c.id,
      name: c.name,
      type: c.type,
      value: c.value,
    })),
    additionalDiscount: record.additionalDiscount,
    customerNotes: record.customerNotes ?? "",
    termsAndConditions: record.termsAndConditions ?? "",
    bankAccountHolder: record.bankAccountHolder ?? "",
    bankName: record.bankName ?? "",
    bankAccountNumber: record.bankAccountNumber ?? "",
    bankIfscCode: record.bankIfscCode ?? "",
    bankBranch: record.bankBranch ?? "",
    bankUpiId: record.bankUpiId ?? "",
    bankPaymentInstructions: record.bankPaymentInstructions ?? "",
    template: record.template,
    reason: record.reason ?? "",
  };
}

/** Seeds a new document from an existing source (Quotation→Tax Invoice
 * conversion, or a Credit Note/Sales Return/Debit Note against a Sales or
 * Purchase invoice) — party/seller snapshot, items, currency and tax
 * config carry over; number/dates/status/reason start fresh. */
function formFromSource(source: InvoiceRecord, targetType: InvoiceType): EditorFormState {
  return {
    type: targetType,
    invoiceNumber: "",
    status: "DRAFT",
    invoiceDate: todayISODate(),
    dueDate: addDaysISODate(15),
    currency: source.currency,
    paymentTerms: source.paymentTerms ?? "",
    referenceNumber: source.referenceNumber ?? "",
    sellerName: source.sellerName,
    sellerAddress: source.sellerAddress ?? "",
    sellerTaxId: source.sellerTaxId ?? "",
    sellerPhone: source.sellerPhone ?? "",
    sellerEmail: source.sellerEmail ?? "",
    sellerLogoUrl: source.sellerLogoUrl ?? "",
    counterpartyUserId: source.counterpartyUserId,
    partyName: source.partyName,
    partyContactPerson: source.partyContactPerson ?? "",
    partyEmail: source.partyEmail ?? "",
    partyPhone: source.partyPhone ?? "",
    partyBillingAddress: source.partyBillingAddress ?? "",
    partyShippingAddress: source.partyShippingAddress ?? "",
    partyTaxId: source.partyTaxId ?? "",
    taxMode: source.taxMode,
    taxBreakup: source.taxBreakup,
    items:
      source.items.length > 0
        ? source.items.map((it) => ({
            key: newItemKey(),
            catalogRowId: it.catalogRowId,
            productName: it.productName,
            description: it.description ?? "",
            hsnSac: it.hsnSac ?? "",
            quantity: it.quantity,
            unit: it.unit,
            rate: it.rate,
            discountPercent: it.discountPercent,
            taxPercent: it.taxPercent,
          }))
        : [emptyItem()],
    shippingType: "FIXED",
    shippingValue: "0",
    additionalCharges: [],
    additionalDiscount: "0",
    customerNotes: "",
    termsAndConditions: source.termsAndConditions ?? "",
    bankAccountHolder: "",
    bankName: "",
    bankAccountNumber: "",
    bankIfscCode: "",
    bankBranch: "",
    bankUpiId: "",
    bankPaymentInstructions: "",
    template: source.template,
    reason: "",
  };
}

export function InvoiceEditor({
  basePath,
  type,
  initialInvoice,
  sourceInvoice,
}: {
  basePath: string;
  type: InvoiceType;
  initialInvoice: InvoiceRecord | null;
  /** Present only when creating a new document derived from an existing
   * one (Quotation conversion, or a Credit Note/Sales Return/Debit Note). */
  sourceInvoice?: InvoiceRecord | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<EditorFormState>(() => {
    if (initialInvoice) return formFromRecord(initialInvoice);
    if (sourceInvoice) return formFromSource(sourceInvoice, type);
    return defaultForm(type);
  });
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState<"draft" | "save" | null>(null);

  // Credit Note / Sales Return / Debit Note only allow editing item
  // Quantity/Rate + Reason/Notes — everything else inherited from the
  // source stays read-only, whether we're creating it fresh (sourceInvoice
  // present) or re-opening an already-saved one (initialInvoice.type).
  const locked = DEPENDENT_TYPES.includes(type);

  function patch(p: Partial<EditorFormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  // Prefill invoice number + seller defaults for a brand-new invoice only.
  useEffect(() => {
    if (initialInvoice) return;
    previewNextInvoiceNumberAction(type).then((r) => {
      if (r.success) setForm((f) => (f.invoiceNumber ? f : { ...f, invoiceNumber: r.data.invoiceNumber }));
    });
    getSellerDefaultsAction().then((r) => {
      if (!r.success) return;
      setForm((f) =>
        f.sellerName
          ? f
          : {
              ...f,
              sellerName: r.data.sellerName,
              sellerEmail: r.data.sellerEmail,
              sellerPhone: r.data.sellerPhone ?? "",
              sellerAddress: r.data.sellerAddress ?? "",
              sellerTaxId: r.data.sellerTaxId ?? "",
              sellerLogoUrl: r.data.sellerLogoUrl ?? "",
            }
      );
    });
  }, [type, initialInvoice]);

  const calc = useMemo(
    () =>
      calculateInvoiceTotals({
        taxMode: form.taxMode,
        taxBreakup: form.taxBreakup,
        items: form.items.map((it) => ({
          quantity: it.quantity,
          rate: it.rate,
          discountPercent: it.discountPercent,
          taxPercent: it.taxPercent,
        })),
        shippingType: form.shippingType,
        shippingValue: form.shippingValue,
        additionalCharges: form.additionalCharges.map((c) => ({
          name: c.name,
          type: c.type,
          value: c.value,
        })),
        additionalDiscount: form.additionalDiscount,
      }),
    [
      form.taxMode,
      form.taxBreakup,
      form.items,
      form.shippingType,
      form.shippingValue,
      form.additionalCharges,
      form.additionalDiscount,
    ]
  );

  // "Save Draft" only makes sense while the invoice hasn't left draft state yet.
  const canSaveAsDraft = !initialInvoice || initialInvoice.status === "DRAFT";

  async function handleSave(targetStatus: "DRAFT" | InvoiceStatus) {
    if (!form.sellerName.trim() || !form.partyName.trim()) {
      toast.error("Seller and party names are required.");
      return;
    }
    if (form.items.every((it) => !it.productName.trim())) {
      toast.error("Add at least one item.");
      return;
    }
    if (locked && !form.reason) {
      toast.error("Select a reason.");
      return;
    }

    setSaving(targetStatus === "DRAFT" ? "draft" : "save");
    const resolvedStatus = initialInvoice && initialInvoice.status !== "DRAFT" ? initialInvoice.status : targetStatus;
    const payload = {
      ...form,
      status: resolvedStatus,
      reason: form.reason || undefined,
      sourceInvoiceId: initialInvoice ? undefined : (sourceInvoice?.id ?? null),
      items: form.items
        .filter((it) => it.productName.trim())
        .map((it, i) => ({
          catalogRowId: it.catalogRowId,
          productName: it.productName,
          description: it.description,
          hsnSac: it.hsnSac,
          quantity: it.quantity,
          unit: it.unit,
          rate: it.rate,
          discountPercent: it.discountPercent,
          taxPercent: it.taxPercent,
          order: i,
        })),
      additionalCharges: form.additionalCharges
        .filter((c) => c.name.trim())
        .map((c) => ({
          name: c.name,
          type: c.type,
          value: c.value,
        })),
    };

    const result = initialInvoice
      ? await updateInvoiceAction(initialInvoice.id, payload)
      : await createInvoiceAction(payload);
    setSaving(null);

    if (!result.success) return toast.error(result.error);
    toast.success(initialInvoice ? "Invoice updated" : targetStatus === "DRAFT" ? "Draft saved" : "Invoice created");
    router.push(`${basePath}/${result.data.id}`);
    router.refresh();
  }

  const previewProps = {
    type: form.type,
    status: form.status,
    invoiceNumber: form.invoiceNumber,
    invoiceDate: form.invoiceDate,
    dueDate: form.dueDate,
    currency: form.currency,
    paymentTerms: form.paymentTerms,
    referenceNumber: form.referenceNumber,
    sellerName: form.sellerName,
    sellerAddress: form.sellerAddress,
    sellerTaxId: form.sellerTaxId,
    sellerPhone: form.sellerPhone,
    sellerEmail: form.sellerEmail,
    sellerLogoUrl: form.sellerLogoUrl,
    partyName: form.partyName,
    partyContactPerson: form.partyContactPerson,
    partyEmail: form.partyEmail,
    partyPhone: form.partyPhone,
    partyBillingAddress: form.partyBillingAddress,
    partyShippingAddress: form.partyShippingAddress,
    partyTaxId: form.partyTaxId,
    taxMode: form.taxMode,
    taxBreakup: form.taxBreakup,
    items: form.items.map((it, i) => ({
      productName: it.productName,
      description: it.description,
      hsnSac: it.hsnSac,
      quantity: it.quantity,
      unit: it.unit,
      rate: it.rate,
      discountPercent: it.discountPercent,
      taxPercent: it.taxPercent,
      taxAmount: calc.items[i]?.taxAmount ?? "0",
      lineTotal: calc.items[i]?.lineTotal ?? "0",
    })),
    totals: calc,
    additionalCharges: calc.additionalCharges,
    customerNotes: form.customerNotes,
    termsAndConditions: form.termsAndConditions,
    bankAccountHolder: form.bankAccountHolder,
    bankName: form.bankName,
    bankAccountNumber: form.bankAccountNumber,
    bankIfscCode: form.bankIfscCode,
    bankBranch: form.bankBranch,
    bankUpiId: form.bankUpiId,
    bankPaymentInstructions: form.bankPaymentInstructions,
  };

  const editForm = (
    <div className="space-y-4">
      <InvoiceHeaderFields form={form} onChange={patch} excludeId={initialInvoice?.id} />
      <div className={locked ? "pointer-events-none opacity-60 space-y-4" : "space-y-4"}>
        <SellerInfoFields form={form} onChange={patch} />
        <PartyPicker form={form} onChange={patch} />
      </div>
      <ItemTable type={form.type} items={form.items} calc={calc} onChange={(items) => patch({ items })} locked={locked} />
      {locked ? (
        <ReasonField form={form} onChange={patch} />
      ) : (
        <>
          <ChargesAndNotesFields form={form} onChange={patch} />
          <BankingDetailsFields form={form} onChange={patch} />
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Invoice Design</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Choose how this document looks — switching never changes any values.</p>
            </div>
            <TemplateSelector value={form.template} onChange={(template) => patch({ template })} />
          </div>
        </>
      )}
      <TotalsSummary calc={calc} currency={form.currency} />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={initialInvoice ? `Edit ${INVOICE_TYPE_LABELS[type]}` : `Create ${INVOICE_TYPE_LABELS[type]}`}
        breadcrumbs={[
          { label: "Invoice Management", href: basePath },
          {
            label: invoiceFamily(type) === "SALES" ? "Sales" : "Purchase",
            href: `${basePath}/${invoiceFamily(type).toLowerCase()}`,
          },
          { label: initialInvoice ? "Edit" : "Create" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push(basePath)}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            {canSaveAsDraft && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={saving !== null}
                onClick={() => handleSave("DRAFT")}
              >
                {saving === "draft" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Draft
              </Button>
            )}
            <Button size="sm" className="gap-1.5" disabled={saving !== null} onClick={() => handleSave(nonDraftInitialStatus(type))}>
              {saving === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {initialInvoice ? "Update Invoice" : "Save Invoice"}
            </Button>
          </div>
        }
      />

      {/* Mobile / tablet: Edit | Preview toggle */}
      <div className="lg:hidden">
        <Tabs value={view} onValueChange={(v) => v && setView(v as "edit" | "preview")}>
          <TabsList className="mb-4">
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="edit">{editForm}</TabsContent>
          <TabsContent value="preview">
            <InvoiceTemplateRenderer template={form.template} {...previewProps} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop: split view, live preview always visible */}
      <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start">
        {editForm}
        <div className="sticky top-4">
          <InvoiceTemplateRenderer template={form.template} {...previewProps} />
        </div>
      </div>
    </div>
  );
}
