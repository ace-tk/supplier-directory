"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Eye, Paperclip, Building2, Truck, User, CreditCard, MapPin, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InvoiceTemplateRenderer } from "@/components/invoicing/templates/InvoiceTemplateRenderer";
import { buildExpenseVoucherPreviewProps } from "@/lib/expenses/voucher-preview";
import { formatMoney, formatShortDate, PAYMENT_METHOD_LABELS } from "@/lib/invoicing/ui";
import { categoryDisplayLabel } from "./CategoryBadge";
import type { ExpenseRecord } from "@/types/expense";

export function ExpenseDetailView({ basePath, expense, ownerName }: { basePath: string; expense: ExpenseRecord; ownerName: string }) {
  const router = useRouter();
  const [previewOpen, setPreviewOpen] = useState(false);
  const expensesPath = `${basePath}/expenses`;

  const categoryLabel = categoryDisplayLabel({ category: expense.category, customCategoryLabel: expense.customCategoryLabel });
  const partyLabel = expense.buyerName || expense.supplierName || expense.manualPartyName || "";
  const contactName = expense.contactName || expense.manualContactName;
  const contactPhone = expense.contactPhone || expense.manualContactPhone;
  const contactCountryCode = expense.manualContactCountryCode;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${categoryLabel} — ${formatMoney(expense.amount, expense.currency)}`}
        description={formatShortDate(expense.occurredAt)}
        breadcrumbs={[
          { label: "Invoice Management", href: basePath },
          { label: "Expenses", href: expensesPath },
          { label: "View" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push(expensesPath)}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <Button size="sm" className="gap-1.5" render={<Link href={`${expensesPath}/${expense.id}/edit`} />} nativeButton={false}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <DetailCard icon={Building2} title="Related Buyer">
          {expense.buyerName ? (
            <div className="space-y-2">
              <Field label="Buyer" value={expense.buyerName} />
              {expense.relatedInvoiceNumber ? (
                <Field
                  label="Linked Invoice"
                  value={`${expense.relatedInvoiceNumber}${expense.relatedInvoiceDate ? ` · ${formatShortDate(expense.relatedInvoiceDate)}` : ""}`}
                />
              ) : (
                <p className="text-xs text-muted-foreground">No invoice linked.</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No buyer linked.</p>
          )}
        </DetailCard>

        <DetailCard icon={Truck} title="Supplier">
          {expense.supplierName ? (
            <div className="space-y-2">
              <Field label="Supplier" value={expense.supplierName} />
              {expense.relatedPurchaseInvoiceNumber ? (
                <Field
                  label="Related Purchase"
                  value={`${expense.relatedPurchaseInvoiceNumber}${expense.relatedPurchaseInvoiceDate ? ` · ${formatShortDate(expense.relatedPurchaseInvoiceDate)}` : ""}`}
                />
              ) : (
                <p className="text-xs text-muted-foreground">No purchase linked.</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No supplier linked.</p>
          )}
        </DetailCard>

        {!expense.buyerName && !expense.supplierName && expense.manualPartyName && (
          <DetailCard icon={Building2} title="Company / Person">
            <Field label="Name" value={expense.manualPartyName} />
          </DetailCard>
        )}

        <DetailCard icon={User} title="Contact">
          {contactName ? (
            <div className="space-y-2">
              <Field label="Name" value={contactName} />
              {expense.contactEmail && <Field label="Email" value={expense.contactEmail} />}
              {contactPhone && <Field label="Phone" value={`${contactCountryCode ?? ""} ${contactPhone}`.trim()} />}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No contact recorded.</p>
          )}
        </DetailCard>

        <DetailCard icon={CreditCard} title="Paid Via">
          <div className="space-y-2">
            <Field label="Transaction Type" value={expense.paymentMethod ? PAYMENT_METHOD_LABELS[expense.paymentMethod] : "Not specified"} />
            {expense.paymentAccountLabel && (
              <Field
                label="Account"
                value={`${expense.paymentAccountLabel}${expense.paymentAccountLast4 ? ` •••• ${expense.paymentAccountLast4}` : ""}`}
              />
            )}
            {expense.paymentAccountProvider && <Field label="Bank / Card Provider" value={expense.paymentAccountProvider} />}
            {expense.referenceNumber && (
              <Field label={expense.paymentMethod === "CHEQUE" ? "Cheque Number" : "Reference Number"} value={expense.referenceNumber} />
            )}
          </div>
        </DetailCard>

        <DetailCard icon={MapPin} title="GST & Location">
          <div className="space-y-2">
            <Field label="GST Number" value={expense.gstNumber || "—"} />
            <Field label="Location" value={expense.location || "—"} />
          </div>
        </DetailCard>

        {expense.createVoucher && (
          <DetailCard icon={FileText} title="Voucher">
            <div className="space-y-2">
              <Field label="Template" value={expense.voucherTemplate ?? "REGULAR"} />
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPreviewOpen(true)}>
                <Eye className="h-3.5 w-3.5" /> Preview Voucher
              </Button>
            </div>
          </DetailCard>
        )}

        {expense.attachmentUrl && (
          <DetailCard icon={Paperclip} title="Receipt">
            <a href={expense.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
              {expense.attachmentFileName || "View attachment"}
            </a>
          </DetailCard>
        )}
      </div>

      {expense.notes && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-2">Notes</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{expense.notes}</p>
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Voucher Preview</DialogTitle>
          </DialogHeader>
          <InvoiceTemplateRenderer
            template={expense.voucherTemplate ?? "REGULAR"}
            {...buildExpenseVoucherPreviewProps({
              ownerName,
              occurredAt: expense.occurredAt.slice(0, 10),
              amount: expense.amount,
              currency: expense.currency,
              category: expense.category,
              customCategoryLabel: expense.customCategoryLabel ?? "",
              partyLabel,
              gstNumber: expense.gstNumber ?? "",
              gstPercent: expense.gstPercent,
              notes: expense.notes ?? "",
              referenceNumber: expense.referenceNumber ?? "",
              isSupplierLinked: Boolean(expense.supplierUserId),
            })}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailCard({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}
