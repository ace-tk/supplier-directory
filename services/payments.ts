"use server";

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { resolveInvoiceAccess } from "@/lib/invoicing/permissions";
import { computeInvoicePaymentSummary } from "@/lib/invoicing/payments";
import { logInvoiceActivity } from "@/lib/invoicing/activity";
import { recordPaymentSchema } from "@/lib/validations/payments";
import { formatMoney } from "@/lib/invoicing/ui";
import type { InvoiceActionResult, PaymentRecord, RecordPaymentInput } from "@/types/invoicing";

function mapPayment(p: {
  id: string;
  invoiceId: string;
  amount: unknown;
  paymentDate: Date;
  method: string;
  referenceNumber: string | null;
  notes: string | null;
  createdById: string;
  createdAt: Date;
  createdBy: { name: string | null; email: string | null };
}): PaymentRecord {
  return {
    id: p.id,
    invoiceId: p.invoiceId,
    amount: String(p.amount),
    paymentDate: p.paymentDate.toISOString(),
    method: p.method as PaymentRecord["method"],
    referenceNumber: p.referenceNumber,
    notes: p.notes,
    createdById: p.createdById,
    createdByName: p.createdBy.name || p.createdBy.email || "Unknown",
    createdAt: p.createdAt.toISOString(),
  };
}

export async function listPaymentsForInvoiceAction(invoiceId: string): Promise<InvoiceActionResult<PaymentRecord[]>> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: { ownerId: true, counterpartyUserId: true },
  });
  if (!invoice) return { success: false, error: "Invoice not found." };

  const access = resolveInvoiceAccess({ userId: user.id, invoice });
  if (!access.canView) return { success: false, error: "Invoice not found." };

  const rows = await db.payment.findMany({
    where: { invoiceId },
    orderBy: { paymentDate: "desc" },
    include: { createdBy: { select: { name: true, email: true } } },
  });

  return { success: true, data: rows.map(mapPayment) };
}

export async function recordPaymentAction(invoiceId: string, input: RecordPaymentInput): Promise<InvoiceActionResult<PaymentRecord>> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: { ownerId: true, counterpartyUserId: true, type: true, grandTotal: true, status: true, currency: true, invoiceNumber: true },
  });
  if (!invoice) return { success: false, error: "Invoice not found." };

  const access = resolveInvoiceAccess({ userId: user.id, invoice });
  if (!access.isOwner) return { success: false, error: "Only the invoice owner can record payments." };

  if (invoice.type !== "SALES" && invoice.type !== "PURCHASE") {
    return { success: false, error: "Payments can only be recorded against a Tax Invoice or Purchase Invoice." };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const existingPayments = await tx.payment.findMany({ where: { invoiceId }, select: { amount: true } });
      const summaryBefore = computeInvoicePaymentSummary(
        String(invoice.grandTotal),
        existingPayments.map((p) => ({ amount: String(p.amount) }))
      );

      if (Number(d.amount) > Number(summaryBefore.balanceDue)) {
        throw new OverpaymentError(
          `That would exceed the balance due (${formatMoney(summaryBefore.balanceDue, invoice.currency)}).`
        );
      }

      const payment = await tx.payment.create({
        data: {
          invoiceId,
          amount: d.amount,
          paymentDate: new Date(d.paymentDate),
          method: d.method,
          referenceNumber: d.referenceNumber?.trim() || null,
          notes: d.notes?.trim() || null,
          createdById: user.id,
        },
        include: { createdBy: { select: { name: true, email: true } } },
      });

      const summaryAfter = computeInvoicePaymentSummary(String(invoice.grandTotal), [
        ...existingPayments.map((p) => ({ amount: String(p.amount) })),
        { amount: d.amount },
      ]);

      const nextStatus = summaryAfter.isFullyPaid ? "PAID" : summaryAfter.isPartiallyPaid ? "PARTIALLY_PAID" : invoice.status;
      if (nextStatus !== invoice.status) {
        await tx.invoice.update({ where: { id: invoiceId }, data: { status: nextStatus } });
      }

      await logInvoiceActivity(
        invoiceId,
        "PAYMENT_RECORDED",
        `${formatMoney(d.amount, invoice.currency)} recorded via ${d.method.replace("_", " ").toLowerCase()}.`,
        user.id,
        tx
      );

      return payment;
    });

    return { success: true, data: mapPayment(result) };
  } catch (err) {
    if (err instanceof OverpaymentError) return { success: false, error: err.message };
    throw err;
  }
}

class OverpaymentError extends Error {}
