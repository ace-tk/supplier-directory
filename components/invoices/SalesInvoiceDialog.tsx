"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Paperclip, X, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { saveSalesInvoiceAction } from "@/services/invoices";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_OPTIONS, formatMoney } from "@/lib/invoice-ui";
import type { SalesInvoiceRecord, InvoiceStatus } from "@/types/invoice";

interface ItemDraft {
  productName: string;
  quantity: number;
  unitPrice: number;
}

const emptyItem: ItemDraft = { productName: "", quantity: 1, unitPrice: 0 };

const empty = {
  customer: "",
  invoiceNumber: "",
  invoiceDate: new Date().toISOString().slice(0, 10),
  dueDate: new Date().toISOString().slice(0, 10),
  items: [emptyItem] as ItemDraft[],
  gst: 0,
  shipping: 0,
  paymentStatus: "DRAFT" as InvoiceStatus,
  notes: "",
  attachmentFileName: "",
  attachmentDataUrl: "",
};

function initialFormFor(invoice: SalesInvoiceRecord | null) {
  if (!invoice) return empty;
  return {
    customer: invoice.customer,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate.slice(0, 10),
    dueDate: invoice.dueDate.slice(0, 10),
    items: invoice.items.length > 0 ? invoice.items.map((i) => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice })) : [emptyItem],
    gst: invoice.gst,
    shipping: invoice.shipping,
    paymentStatus: invoice.paymentStatus,
    notes: invoice.notes ?? "",
    attachmentFileName: invoice.attachmentFileName ?? "",
    attachmentDataUrl: invoice.attachmentDataUrl ?? "",
  };
}

// Keyed by invoice id from the parent so opening for a different invoice (or
// "new") remounts this with fresh state — no effect-based prop sync needed.
function SalesInvoiceForm({
  invoice,
  onCancel,
  onSaved,
}: {
  invoice: SalesInvoiceRecord | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => initialFormFor(invoice));
  const [saving, setSaving] = useState(false);

  const itemsTotal = useMemo(() => form.items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0), [form.items]);
  const grandTotal = itemsTotal + form.gst + form.shipping;

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) }));
  }

  async function handleAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setForm((f) => ({ ...f, attachmentFileName: file.name, attachmentDataUrl: dataUrl }));
  }

  async function handleSave() {
    if (!form.customer.trim() || !form.invoiceNumber.trim()) {
      toast.error("Customer and invoice number are required.");
      return;
    }
    const validItems = form.items.filter((it) => it.productName.trim());
    setSaving(true);
    const result = await saveSalesInvoiceAction({ id: invoice?.id, ...form, items: validItems });
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success(invoice ? "Sales invoice updated" : "Sales invoice created");
    onSaved();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{invoice ? "Edit Sales Invoice" : "Create Sales Invoice"}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Customer</Label>
            <Input value={form.customer} onChange={(e) => setForm((f) => ({ ...f, customer: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Invoice Number</Label>
            <Input value={form.invoiceNumber} onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))} />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Invoice Date</Label>
            <Input type="date" value={form.invoiceDate} onChange={(e) => setForm((f) => ({ ...f, invoiceDate: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Due Date</Label>
            <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Payment Status</Label>
            <Select value={form.paymentStatus} onValueChange={(v) => v && setForm((f) => ({ ...f, paymentStatus: v as InvoiceStatus }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INVOICE_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{INVOICE_STATUS_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Product List</Label>
          <div className="space-y-2">
            {form.items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input placeholder="Product name" value={item.productName} onChange={(e) => updateItem(i, { productName: e.target.value })} className="flex-1" />
                <Input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) || 1 })} className="w-20" aria-label="Quantity" />
                <Input type="number" min={0} value={item.unitPrice} onChange={(e) => updateItem(i, { unitPrice: Number(e.target.value) || 0 })} className="w-28" aria-label="Unit price" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))}
                  disabled={form.items.length === 1}
                  aria-label="Remove item"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setForm((f) => ({ ...f, items: [...f.items, emptyItem] }))}>
            <Plus className="h-3.5 w-3.5" /> Add Product
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">GST</Label>
            <Input type="number" min={0} value={form.gst} onChange={(e) => setForm((f) => ({ ...f, gst: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Shipping</Label>
            <Input type="number" min={0} value={form.shipping} onChange={(e) => setForm((f) => ({ ...f, shipping: Number(e.target.value) }))} />
          </div>
        </div>

        <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Grand Total</span>
          <span className="text-lg font-semibold text-primary tabular-nums">{formatMoney(grandTotal)}</span>
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

export function SalesInvoiceDialog({
  invoice,
  open,
  onOpenChange,
  onSaved,
}: {
  invoice: SalesInvoiceRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto scrollbar-thin">
        {open && (
          <SalesInvoiceForm
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
