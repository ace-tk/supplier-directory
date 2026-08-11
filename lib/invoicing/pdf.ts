"use client";

// Real client-side PDF generation for invoices. Consumes the exact same
// InvoicePreviewProps the on-screen InvoicePreview renders from (built via
// toInvoicePreviewProps) — there is no second calculation or data mapping
// here, only a different renderer for identical numbers.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { InvoicePreviewProps } from "@/components/invoicing/preview/InvoicePreview";
import { INVOICE_STATUS_LABELS, INVOICE_TYPE_LABELS } from "@/lib/invoicing/ui";

// jsPDF's standard fonts (Helvetica/WinAnsi) don't include the ₹ glyph, so
// currency symbols render as boxes. Use the ISO code instead of Intl's
// symbol formatting for anything that ends up inside the PDF.
function pdfMoney(value: string, currency: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const formatted = n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency} ${formatted}`;
}

function isoOrRaw(date: string): string {
  if (!date) return "—";
  const iso = date.length === 10 ? `${date}T00:00:00.000Z` : date;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function buildInvoicePdf(props: InvoicePreviewProps): jsPDF {
  const { type, status, invoiceNumber, invoiceDate, dueDate, currency, paymentTerms, referenceNumber } = props;
  const money = (v: string) => pdfMoney(v, currency);

  const doc = new jsPDF();
  const marginX = 14;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(props.sellerName || "Your Company", marginX, 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  let sellerY = 24;
  if (props.sellerAddress) {
    const lines = doc.splitTextToSize(props.sellerAddress, 90);
    doc.text(lines, marginX, sellerY);
    sellerY += lines.length * 4;
  }
  const sellerContact = [props.sellerEmail, props.sellerPhone].filter(Boolean).join("   ");
  if (sellerContact) {
    doc.text(sellerContact, marginX, sellerY);
    sellerY += 4;
  }
  if (props.sellerTaxId) {
    doc.text(`GSTIN: ${props.sellerTaxId}`, marginX, sellerY);
    sellerY += 4;
  }

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(INVOICE_TYPE_LABELS[type], 196, 18, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(invoiceNumber || "—", 196, 24, { align: "right" });
  if (status) {
    doc.text(`Status: ${INVOICE_STATUS_LABELS[status]}`, 196, 30, { align: "right" });
  }

  let y = Math.max(sellerY, 34) + 6;

  doc.setFontSize(9);
  doc.text(`Invoice Date: ${isoOrRaw(invoiceDate)}`, marginX, y);
  doc.text(`Due Date: ${isoOrRaw(dueDate)}`, 90, y);
  if (paymentTerms) doc.text(`Terms: ${paymentTerms}`, 145, y);
  y += 5;
  if (referenceNumber) {
    doc.text(`Reference / PO: ${referenceNumber}`, marginX, y);
    y += 5;
  }

  y += 3;
  const partyLabel = type === "PURCHASE" || type === "DEBIT_NOTE" ? "Bill From" : "Bill To";
  doc.setFont("helvetica", "bold");
  doc.text(partyLabel, marginX, y);
  doc.setFont("helvetica", "normal");
  y += 5;
  doc.text(props.partyName || "—", marginX, y);
  y += 4.5;
  if (props.partyContactPerson) {
    doc.text(`Attn: ${props.partyContactPerson}`, marginX, y);
    y += 4.5;
  }
  const partyContact = [props.partyEmail, props.partyPhone].filter(Boolean).join("   ");
  if (partyContact) {
    doc.text(partyContact, marginX, y);
    y += 4.5;
  }
  if (props.partyTaxId) {
    doc.text(`GSTIN: ${props.partyTaxId}`, marginX, y);
    y += 4.5;
  }
  if (props.partyBillingAddress) {
    const lines = doc.splitTextToSize(`Billing: ${props.partyBillingAddress}`, 180);
    doc.text(lines, marginX, y);
    y += lines.length * 4.5;
  }
  if (props.partyShippingAddress) {
    const lines = doc.splitTextToSize(`Shipping: ${props.partyShippingAddress}`, 180);
    doc.text(lines, marginX, y);
    y += lines.length * 4.5;
  }

  autoTable(doc, {
    startY: y + 4,
    head: [["Item", "Qty", "Rate", "Disc%", "Tax%", "Tax Amt", "Amount"]],
    body:
      props.items.length === 0
        ? [["No items added", "", "", "", "", "", ""]]
        : props.items.map((item) => [
            [item.productName || "Untitled item", item.hsnSac ? `HSN/SAC: ${item.hsnSac}` : ""].filter(Boolean).join("\n"),
            `${item.quantity} ${item.unit}`,
            money(String(item.rate)),
            item.discountPercent ? `${item.discountPercent}%` : "—",
            item.taxPercent ? `${item.taxPercent}%` : "—",
            money(item.taxAmount),
            money(item.lineTotal),
          ]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 30, 30] },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jspdf-autotable augments jsPDF at runtime without updated types
  const afterItemsY = (doc as any).lastAutoTable?.finalY ?? y + 20;

  const totalsRows: [string, string][] = [["Subtotal", money(props.totals.subtotal)]];
  if (Number(props.totals.itemDiscountTotal) > 0) totalsRows.push(["Item Discounts", `- ${money(props.totals.itemDiscountTotal)}`]);
  totalsRows.push(["Taxable Amount", money(props.totals.taxableAmount)]);
  if (props.taxBreakup === "CGST_SGST") {
    totalsRows.push(["CGST", money(props.totals.cgstTotal)], ["SGST", money(props.totals.sgstTotal)]);
  } else if (props.taxBreakup === "IGST") {
    totalsRows.push(["IGST", money(props.totals.igstTotal)]);
  } else {
    totalsRows.push(["Tax (GST)", money(props.totals.taxTotal)]);
  }
  if (Number(props.totals.shippingCharge) > 0) {
    const shippingLabel = props.totals.shippingType === "PERCENT" ? `Shipping (${props.totals.shippingValue}%)` : "Shipping";
    totalsRows.push([shippingLabel, money(props.totals.shippingCharge)]);
  }
  for (const c of props.additionalCharges) {
    const label = c.type === "PERCENT" ? `${c.name} (${c.value}%)` : c.name;
    totalsRows.push([label, money(c.amount)]);
  }
  if (Number(props.totals.additionalDiscount) > 0)
    totalsRows.push(["Additional Discount", `- ${money(props.totals.additionalDiscount)}`]);
  if (Number(props.totals.roundOff) !== 0) totalsRows.push(["Round Off", money(props.totals.roundOff)]);
  totalsRows.push(["Grand Total", money(props.totals.grandTotal)]);

  autoTable(doc, {
    startY: afterItemsY + 4,
    body: totalsRows,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.2 },
    columnStyles: { 0: { cellWidth: 40 }, 1: { halign: "right", cellWidth: 40 } },
    margin: { left: 196 - 80 },
    didParseCell: (data) => {
      if (data.row.index === totalsRows.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 10;
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jspdf-autotable augments jsPDF at runtime without updated types
  let finalY = (doc as any).lastAutoTable?.finalY ?? afterItemsY + 40;

  if (props.customerNotes) {
    finalY += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Notes", marginX, finalY);
    doc.setFont("helvetica", "normal");
    finalY += 5;
    const lines = doc.splitTextToSize(props.customerNotes, 180);
    doc.text(lines, marginX, finalY);
    finalY += lines.length * 4.5;
  }

  if (props.termsAndConditions) {
    finalY += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Terms & Conditions", marginX, finalY);
    doc.setFont("helvetica", "normal");
    finalY += 5;
    const lines = doc.splitTextToSize(props.termsAndConditions, 180);
    doc.text(lines, marginX, finalY);
    finalY += lines.length * 4.5;
  }

  const bankRows: [string, string][] = [
    ["Account Holder", props.bankAccountHolder],
    ["Bank Name", props.bankName],
    ["Account Number", props.bankAccountNumber],
    ["IFSC Code", props.bankIfscCode],
    ["Branch", props.bankBranch],
    ["UPI ID", props.bankUpiId],
  ].filter((r): r is [string, string] => Boolean(r[1]));

  if (bankRows.length > 0 || props.bankPaymentInstructions) {
    finalY += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Banking Details", marginX, finalY);
    doc.setFont("helvetica", "normal");
    finalY += 5;
    for (const [label, value] of bankRows) {
      doc.text(`${label}: ${value}`, marginX, finalY);
      finalY += 4.5;
    }
    if (props.bankPaymentInstructions) {
      const lines = doc.splitTextToSize(props.bankPaymentInstructions, 180);
      doc.text(lines, marginX, finalY);
    }
  }

  return doc;
}

export function downloadInvoicePdf(props: InvoicePreviewProps) {
  const fileName = `${props.type.toLowerCase()}-${props.invoiceNumber || "draft"}.pdf`;
  buildInvoicePdf(props).save(fileName);
}
