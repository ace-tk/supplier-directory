"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Paperclip, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { savePurchaseInvoiceAction } from "@/services/invoices";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_OPTIONS } from "@/lib/invoice-ui";
import type { PurchaseInvoiceRecord, InvoiceStatus } from "@/types/invoice";

const empty = {
  vendor: "",
  poNumber: "",
  invoiceNumber: "",
  invoiceDate: new Date().toISOString().slice(0, 10),
  dueDate: new Date().toISOString().slice(0, 10),
  gst: 0,
  shipping: 0,
  totalAmount: 0,
  status: "DRAFT" as InvoiceStatus,
  notes: "",
  attachmentFileName: "",
  attachmentDataUrl: "",
};

function initialFormFor(invoice: PurchaseInvoiceRecord | null) {
  if (!invoice) return empty;
  return {
    vendor: invoice.vendor,
    poNumber: invoice.poNumber ?? "",
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate.slice(0, 10),
    dueDate: invoice.dueDate.slice(0, 10),
    gst: invoice.gst,
    shipping: invoice.shipping,
    totalAmount: invoice.totalAmount,
    status: invoice.status,
    notes: invoice.notes ?? "",
    attachmentFileName: invoice.attachmentFileName ?? "",
    attachmentDataUrl: invoice.attachmentDataUrl ?? "",
  };
}

// Keyed by invoice id from the parent so opening for a different invoice (or
// "new") remounts this with fresh state — no effect-based prop sync needed.
function PurchaseInvoiceForm({
  invoice,
  onCancel,
  onSaved,
}: {
  invoice: PurchaseInvoiceRecord | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => initialFormFor(invoice));
  const [saving, setSaving] = useState(false);

  async function handleAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setForm((f) => ({ ...f, attachmentFileName: file.name, attachmentDataUrl: dataUrl }));
  }

  async function handleSave() {
    if (!form.vendor.trim() || !form.invoiceNumber.trim()) {
      toast.error("Vendor and invoice number are required.");
      return;
    }
    setSaving(true);
    const result = await savePurchaseInvoiceAction({ id: invoice?.id, ...form });
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success(invoice ? "Purchase invoice updated" : "Purchase invoice created");
    onSaved();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{invoice ? "Edit Purchase Invoice" : "Create Purchase Invoice"}</DialogTitle>
      </DialogHeader>

      <div className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Vendor</Label>
            <Input value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Purchase Order Number</Label>
            <Input value={form.poNumber} onChange={(e) => setForm((f) => ({ ...f, poNumber: e.target.value }))} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Invoice Number</Label>
            <Input value={form.invoiceNumber} onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={(v) => v && setForm((f) => ({ ...f, status: v as InvoiceStatus }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INVOICE_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{INVOICE_STATUS_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Invoice Date</Label>
            <Input type="date" value={form.invoiceDate} onChange={(e) => setForm((f) => ({ ...f, invoiceDate: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Due Date</Label>
            <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">GST</Label>
            <Input type="number" min={0} value={form.gst} onChange={(e) => setForm((f) => ({ ...f, gst: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Shipping</Label>
            <Input type="number" min={0} value={form.shipping} onChange={(e) => setForm((f) => ({ ...f, shipping: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Total Amount</Label>
            <Input type="number" min={0} value={form.totalAmount} onChange={(e) => setForm((f) => ({ ...f, totalAmount: Number(e.target.value) }))} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Notes</Label>
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Attachment</Label>
          {form.attachmentFileName ? (
            <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-foreground truncate flex-1">{form.attachmentFileName}</span>
              <button type="button" onClick={() => setForm((f) => ({ ...f, attachmentFileName: "", attachmentDataUrl: "" }))} aria-label="Remove attachment">
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 rounded-lg border-2 border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors cursor-pointer">
              <Paperclip className="h-3.5 w-3.5" /> Attach a file
              <input type="file" className="hidden" onChange={handleAttachment} />
            </label>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {invoice ? "Save Changes" : "Create Invoice"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function PurchaseInvoiceDialog({
  invoice,
  open,
  onOpenChange,
  onSaved,
}: {
  invoice: PurchaseInvoiceRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto scrollbar-thin">
        {open && (
          <PurchaseInvoiceForm
            key={invoice?.id ?? "new"}
            invoice={invoice}
            onCancel={() => onOpenChange(false)}
            onSaved={() => {
              onSaved();
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
