"use client";

// Real client-side PDF generation for invoices — no server round-trip needed.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { PurchaseInvoiceRecord, SalesInvoiceRecord } from "@/types/invoice";

function money(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function baseDoc(title: string, invoiceNumber: string) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("SupplyBase", 14, 20);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(title, 14, 28);
  doc.setFontSize(10);
  doc.text(`Invoice #${invoiceNumber}`, 14, 34);
  return doc;
}

export function buildPurchaseInvoicePdf(invoice: PurchaseInvoiceRecord): jsPDF {
  const doc = baseDoc("Purchase Invoice", invoice.invoiceNumber);

  doc.setFontSize(10);
  doc.text(`Vendor: ${invoice.vendor}`, 14, 44);
  if (invoice.poNumber) doc.text(`PO Number: ${invoice.poNumber}`, 14, 50);
  doc.text(`Invoice Date: ${new Date(invoice.invoiceDate).toLocaleDateString("en-IN")}`, 120, 44);
  doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString("en-IN")}`, 120, 50);
  doc.text(`Status: ${invoice.status}`, 120, 56);

  autoTable(doc, {
    startY: 65,
    head: [["Description", "Amount"]],
    body: [
      ["Subtotal", money(invoice.totalAmount - invoice.gst - invoice.shipping)],
      ["GST", money(invoice.gst)],
      ["Shipping", money(invoice.shipping)],
      ["Total Amount", money(invoice.totalAmount)],
    ],
    theme: "striped",
  });

  if (invoice.notes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jspdf-autotable augments jsPDF at runtime without updated types
    const finalY = (doc as any).lastAutoTable?.finalY ?? 100;
    doc.setFontSize(9);
    doc.text("Notes:", 14, finalY + 10);
    doc.text(doc.splitTextToSize(invoice.notes, 180), 14, finalY + 16);
  }

  return doc;
}

export function buildSalesInvoicePdf(invoice: SalesInvoiceRecord): jsPDF {
  const doc = baseDoc("Sales Invoice", invoice.invoiceNumber);

  doc.setFontSize(10);
  doc.text(`Customer: ${invoice.customer}`, 14, 44);
  doc.text(`Invoice Date: ${new Date(invoice.invoiceDate).toLocaleDateString("en-IN")}`, 120, 44);
  doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString("en-IN")}`, 120, 50);
  doc.text(`Payment Status: ${invoice.paymentStatus}`, 120, 56);

  autoTable(doc, {
    startY: 65,
    head: [["Product", "Qty", "Unit Price", "Line Total"]],
    body: invoice.items.map((it) => [it.productName, String(it.quantity), money(it.unitPrice), money(it.quantity * it.unitPrice)]),
    theme: "striped",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jspdf-autotable augments jsPDF at runtime without updated types
  const afterItemsY = (doc as any).lastAutoTable?.finalY ?? 100;

  autoTable(doc, {
    startY: afterItemsY + 6,
    body: [
      ["GST", money(invoice.gst)],
      ["Shipping", money(invoice.shipping)],
      ["Grand Total", money(invoice.grandTotal)],
    ],
    theme: "plain",
    styles: { fontStyle: "bold" },
    margin: { left: 120 },
  });

  if (invoice.notes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jspdf-autotable augments jsPDF at runtime without updated types
    const finalY = (doc as any).lastAutoTable?.finalY ?? 130;
    doc.setFontSize(9);
    doc.text("Notes:", 14, finalY + 10);
    doc.text(doc.splitTextToSize(invoice.notes, 180), 14, finalY + 16);
  }

  return doc;
}

export function downloadPurchaseInvoicePdf(invoice: PurchaseInvoiceRecord) {
  buildPurchaseInvoicePdf(invoice).save(`purchase-invoice-${invoice.invoiceNumber}.pdf`);
}

export function downloadSalesInvoicePdf(invoice: SalesInvoiceRecord) {
  buildSalesInvoicePdf(invoice).save(`sales-invoice-${invoice.invoiceNumber}.pdf`);
}

export function printPurchaseInvoice(invoice: PurchaseInvoiceRecord) {
  const url = buildPurchaseInvoicePdf(invoice).output("bloburl");
  window.open(url, "_blank")?.print();
}

export function printSalesInvoice(invoice: SalesInvoiceRecord) {
  const url = buildSalesInvoicePdf(invoice).output("bloburl");
  window.open(url, "_blank")?.print();
}
